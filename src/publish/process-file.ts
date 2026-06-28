import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { mdToHast } from '../pipeline/md-to-hast.js';
import { hastToMast, type ConversionWarning } from '../pipeline/hast-to-mast.js';
import { processAssets } from './asset-adapter.js';
import { mastToNoteAtom } from '../noteatom/from-mast.js';
import type { MowenClient } from '../mowen/client.js';
import type { MASTDocument } from '../mast/types.js';
import type { NoteAtomDoc } from '../noteatom/types.js';

export interface PublishOptions {
  /** 已有笔记 ID（编辑模式），不填则创建新笔记 */
  noteId?: string;
  /** 标签列表 */
  tags?: string[];
  /** 自动发布（非草稿），默认 false */
  autoPublish?: boolean;
  /** dry-run：走完流水线但不调用墨问 API */
  dryRun?: boolean;
  /** 调试缓存目录，写入各阶段产物 */
  cacheDir?: string;
  /** 代码块样式：paragraph（转为段落）或 codeblock（转为代码块节点） */
  codeBlockStyle?: 'paragraph' | 'codeblock';
  /** 静默模式：抑制有损转换警告 */
  quiet?: boolean;
}

export interface PublishResult {
  /** dry-run 时为 undefined */
  noteId?: string;
  /** dry-run 时为 undefined */
  noteUrl?: string;
  dryRun: boolean;
  stats: PipelineStats;
  warnings: ConversionWarning[];
}

export interface PipelineStats {
  paragraphs: number;
  quotes: number;
  images: number;
  tables: number;
  audios: number;
  codeblocks: number;
  totalBlocks: number;
  /** dry-run 时为 0 */
  uploadedAssets: number;
}

/**
 * 单文件完整流水线：Markdown → HAST → MAST → 资源上传 → NoteAtom → 发布
 */
export async function processFile(
  filePath: string,
  client: MowenClient,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  const { noteId, tags, autoPublish = false, dryRun = false, cacheDir, codeBlockStyle, quiet = false } = opts;

  // ── 阶段 00：读取文件 ────────────────────────────────────────────────────────
  const absPath = resolve(filePath);
  const markdown = await readFile(absPath, 'utf8');
  const baseDir = dirname(absPath);

  // ── 阶段 01：Markdown → HAST ─────────────────────────────────────────────────
  const hast = mdToHast(markdown);
  await writeCache(cacheDir, '01-hast.json', hast);

  // ── 阶段 02：HAST → MAST ─────────────────────────────────────────────────────
  const { doc: mast, warnings } = hastToMast(hast, codeBlockStyle ? { codeBlockStyle } : {});
  await writeCache(cacheDir, '02-mast.json', mast);

  // ── 有损转换警告 ───────────────────────────────────────────────────────────
  if (!quiet && warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`⚠️ ${w.message}`);
    }
  }

  // ── 阶段 03：资源处理 ────────────────────────────────────────────────────────
  await processAssets(mast, client, { baseDir, dryRun });
  await writeCache(cacheDir, '03-mast-with-assets.json', mast);

  // ── 统计 ─────────────────────────────────────────────────────────────────────
  const stats = collectStats(mast, dryRun);

  // ── 阶段 04：MAST → NoteAtom ─────────────────────────────────────────────────
  const noteAtom = mastToNoteAtom(mast);
  await writeCache(cacheDir, '04-noteatom.json', noteAtom);

  // ── dry-run：打印报告，不调用 API ────────────────────────────────────────────
  if (dryRun) {
    printDryRunReport(filePath, stats, noteAtom, warnings);
    return { dryRun: true, stats, warnings };
  }

  // ── 阶段 05：发布 ────────────────────────────────────────────────────────────
  let resultNoteId: string;
  if (noteId) {
    await client.editNote(noteId, noteAtom);
    resultNoteId = noteId;
  } else {
    resultNoteId = await client.createNote(noteAtom, { autoPublish, tags: tags ?? [] });
  }

  const noteUrl = `https://mowen.cn/note/${resultNoteId}`;
  return { noteId: resultNoteId, noteUrl, dryRun: false, stats, warnings };
}

// ── 统计 ──────────────────────────────────────────────────────────────────────

function collectStats(mast: MASTDocument, dryRun: boolean): PipelineStats {
  let paragraphs = 0;
  let quotes = 0;
  let images = 0;
  let tables = 0;
  let audios = 0;
  let codeblocks = 0;

  for (const block of Object.values(mast.blocks)) {
    if (block.type === 'paragraph') paragraphs++;
    else if (block.type === 'quote') quotes++;
    else if (block.type === 'image') {
      if (block.isTable) tables++;
      else images++;
    } else if (block.type === 'audio') audios++;
    else if (block.type === 'codeblock') codeblocks++;
  }

  return {
    paragraphs,
    quotes,
    images,
    tables,
    audios,
    codeblocks,
    totalBlocks: paragraphs + quotes + images + tables + audios + codeblocks,
    uploadedAssets: dryRun ? 0 : images + tables + audios,
  };
}

// ── dry-run 报告 ──────────────────────────────────────────────────────────────

function printDryRunReport(
  filePath: string,
  stats: PipelineStats,
  noteAtom: NoteAtomDoc,
  warnings: ConversionWarning[],
): void {
  console.log('\n── dry-run 报告 ──────────────────────────────────────────');
  console.log(`文件：${filePath}`);
  console.log(`\n流水线统计：`);
  console.log(`  段落块：    ${stats.paragraphs}`);
  console.log(`  引用块：    ${stats.quotes}`);
  console.log(`  图片块：    ${stats.images}`);
  console.log(`  表格块：    ${stats.tables}`);
  console.log(`  音频块：    ${stats.audios}`);
  console.log(`  代码块：    ${stats.codeblocks}`);
  console.log(`  总块数：    ${stats.totalBlocks}`);
  console.log(`  待上传资源：${stats.images + stats.tables + stats.audios}（dry-run 跳过）`);

  if (warnings.length > 0) {
    console.log(`\n有损转换警告（${warnings.length} 处）：`);
    for (const w of warnings) {
      console.log(`  ⚠️ ${w.message}`);
    }
  }

  console.log(`\nNoteAtom 预览（前 3 个块）：`);
  const preview = noteAtom.content.slice(0, 3);
  console.log(JSON.stringify(preview, null, 2));
  if (noteAtom.content.length > 3) {
    console.log(`  ... 共 ${noteAtom.content.length} 个块`);
  }
  console.log('\n✅ dry-run 完成，未调用墨问 API。');
  console.log('──────────────────────────────────────────────────────\n');
}

// ── 缓存写入 ──────────────────────────────────────────────────────────────────

async function writeCache(cacheDir: string | undefined, name: string, data: unknown): Promise<void> {
  if (!cacheDir) return;
  const { writeFile, mkdir } = await import('fs/promises');
  await mkdir(cacheDir, { recursive: true });
  await writeFile(resolve(cacheDir, name), JSON.stringify(data, null, 2), 'utf8');
}
