import { readdir, lstat } from 'fs/promises';
import { join, resolve, basename, extname } from 'path';
import { processFile, type PublishOptions } from './process-file.js';
import type { MowenClient } from '../mowen/client.js';

export interface DirectoryOptions extends PublishOptions {
  /** 是否递归扫描子目录，默认 true */
  recursive?: boolean;
}

export interface FileResult {
  filePath: string;
  status: 'success' | 'failed' | 'skipped';
  /** dry-run 时为 undefined */
  noteId?: string;
  /** dry-run 时为 undefined */
  noteUrl?: string;
  error?: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  files: FileResult[];
}

/**
 * 扫描目录中的 Markdown 文件
 * - 递归扫描（除非 recursive = false）
 * - 按文件名排序
 * - 跳过隐藏文件、非 .md 文件、符号链接
 */
export async function scanMarkdownFiles(dirPath: string, recursive: boolean = true): Promise<string[]> {
  const absPath = resolve(dirPath);
  const files: string[] = [];

  await scanDir(absPath, files, recursive);

  // 按文件名排序（basename）
  files.sort((a, b) => basename(a).localeCompare(basename(b)));

  return files;
}

async function scanDir(dir: string, files: string[], recursive: boolean): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // 跳过隐藏文件（.开头）
    if (entry.name.startsWith('.')) continue;

    // 跳过符号链接
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory() && recursive) {
      await scanDir(fullPath, files, recursive);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(fullPath);
    }
  }
}

/**
 * 批量发布目录中的 Markdown 文件
 */
export async function processDirectory(
  dirPath: string,
  client: MowenClient,
  opts: DirectoryOptions = {},
): Promise<BatchResult> {
  const { recursive = true } = opts;
  const absDirPath = resolve(dirPath);

  // 检查目录是否存在
  const dirStat = await lstat(absDirPath);
  if (!dirStat.isDirectory()) {
    throw new Error(`路径不是目录: ${absDirPath}`);
  }

  // 扫描文件
  const files = await scanMarkdownFiles(absDirPath, recursive);

  // 空目录处理
  if (files.length === 0) {
    console.log(`目录 ${absDirPath} 中没有 Markdown 文件`);
    return { total: 0, success: 0, failed: 0, skipped: 0, files: [] };
  }

  console.log(`发现 ${files.length} 个 Markdown 文件，开始发布...\n`);

  const results: FileResult[] = [];
  let index = 0;

  for (const filePath of files) {
    index++;
    const fileName = basename(filePath);
    console.log(`[${index}/${files.length}] ${fileName}`);

    try {
      const result = await processFile(filePath, client, opts);
      results.push({
        filePath,
        status: 'success',
        ...(result.noteId ? { noteId: result.noteId } : {}),
        ...(result.noteUrl ? { noteUrl: result.noteUrl } : {}),
      });
      console.log(`  ✅ 发布成功: ${result.noteUrl ?? '(dry-run)'}\n`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        filePath,
        status: 'failed',
        error: errorMsg,
      });
      console.log(`  ❌ 发布失败: ${errorMsg}\n`);
    }

    // 文件间隔 1.1 秒（最后一个文件不等待）
    if (index < files.length) {
      await sleep(1100);
    }
  }

  // 汇总报告
  const summary = computeSummary(results);
  printSummary(summary);

  return summary;
}

function computeSummary(files: FileResult[]): BatchResult {
  const success = files.filter((f) => f.status === 'success').length;
  const failed = files.filter((f) => f.status === 'failed').length;
  const skipped = files.filter((f) => f.status === 'skipped').length;

  return {
    total: files.length,
    success,
    failed,
    skipped,
    files,
  };
}

function printSummary(result: BatchResult): void {
  console.log('── 发布汇总 ──────────────────────────────────────────');
  console.log(`总计：${result.total} 个文件`);
  console.log(`  ✅ 成功：${result.success}`);
  console.log(`  ❌ 失败：${result.failed}`);
  console.log(`  ⏭️  跳过：${result.skipped}`);

  if (result.failed > 0) {
    console.log('\n失败文件：');
    for (const f of result.files.filter((f) => f.status === 'failed')) {
      console.log(`  - ${basename(f.filePath)}: ${f.error ?? '未知错误'}`);
    }
  }

  console.log('──────────────────────────────────────────────────────\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
