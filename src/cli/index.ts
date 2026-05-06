#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { processFile } from '../publish/process-file.js';
import { MowenClient } from '../mowen/client.js';
import { noteAtomToMast } from '../noteatom/to-mast.js';
import { mastToMarkdown } from '../mast/to-markdown.js';
import { findMetadataPath, readMetadata, writeMetadata, lookupNote, upsertNote } from '../shared/metadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 配置文件搜索路径 ──────────────────────────────────────────────────────────

interface ConfigLocation {
  label: string;
  path: string;
}

/** 按优先级搜索 .env 文件 */
function searchEnvPaths(): ConfigLocation[] {
  const projectRoot = resolve(__dirname, '../../');
  return [
    { label: '项目根目录', path: join(projectRoot, '.env') },
    { label: '当前工作目录', path: resolve(process.cwd(), '.env') },
    { label: '用户主目录', path: join(homedir(), '.md-to-mowen.env') },
  ];
}

/** 加载 .env，返回找到的路径列表 */
function loadEnvConfig(): string[] {
  const locations = searchEnvPaths();
  const found: string[] = [];

  for (const loc of locations) {
    if (existsSync(loc.path)) {
      config({ path: loc.path });
      found.push(loc.label);
    }
  }

  return found;
}

function getApiKey(): string | undefined {
  return process.env.MOWEN_API_KEY;
}

function getEnvWritePath(): string {
  // 写入项目根目录 .env
  return join(resolve(__dirname, '../../'), '.env');
}

async function promptApiKey(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log('获取 API Key 的步骤：');
  console.log('  1. 打开微信，搜索"墨问"小程序');
  console.log('  2. 进入个人主页');
  console.log('  3. 点击「开发者」');
  console.log('  4. 进入「我的 API Key」页面');
  console.log('  5. 复制 API Key');
  console.log('');

  return new Promise((resolve) => {
    rl.question('请粘贴你的 MOWEN_API_KEY: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function saveApiKey(apiKey: string): void {
  const envPath = getEnvWritePath();
  const content = `MOWEN_API_KEY=${apiKey}\n`;

  // 如果文件已存在，读取并替换；否则创建新文件
  if (existsSync(envPath)) {
    const existing = readFileSync(envPath, 'utf8');
    const lines = existing.split('\n');
    const idx = lines.findIndex((l) => l.startsWith('MOWEN_API_KEY='));

    if (idx !== -1) {
      lines[idx] = `MOWEN_API_KEY=${apiKey}`;
    } else {
      lines.push(`MOWEN_API_KEY=${apiKey}`);
    }

    writeFileSync(envPath, lines.filter((l) => l.trim()).join('\n') + '\n', 'utf8');
  } else {
    mkdirSync(dirname(envPath), { recursive: true });
    writeFileSync(envPath, content, 'utf8');
  }

  console.log(`\n✅ API Key 已保存到 ${envPath}`);
  console.log('   下次运行无需再输入。');
}

// ── 加载配置 ──────────────────────────────────────────────────────────────────

loadEnvConfig();

// ── CLI ───────────────────────────────────────────────────────────────────────

const program = new Command();

program.name('md-to-mowen').description('将 Markdown（GFM）转换为墨问笔记').version('0.0.0');

// ── config ────────────────────────────────────────────────────────────────────

program
  .command('config')
  .description('设置墨问 API Key')
  .action(async () => {
    const existingKey = getApiKey();

    if (existingKey) {
      console.log(`当前 MOWEN_API_KEY: ${existingKey.slice(0, 8)}...${existingKey.slice(-4)}`);
    }

    const apiKey = await promptApiKey();

    if (!apiKey) {
      console.error('错误：API Key 不能为空。');
      process.exit(1);
    }

    saveApiKey(apiKey);
  });

// ── publish ────────────────────────────────────────────────────────────────────

program
  .command('publish')
  .description('发布 Markdown 文件为墨问笔记')
  .requiredOption('-i, --input <file>', 'Markdown 文件路径')
  .option('--note-id <id>', '已有笔记 ID（编辑模式，全量替换）')
  .option('--tags <tags>', '标签，逗号分隔（如 "tech,ai"）')
  .option('--auto-publish', '自动发布（非草稿）', false)
  .option('--dry-run', '走完流水线但不调用墨问 API，仅打印统计', false)
  .option('--cache-dir <dir>', '保存各阶段产物的目录（调试用）', 'out/pipeline-cache')
  .action(async (opts) => {
    const apiKey = getApiKey();
    if (!apiKey && !opts.dryRun) {
      console.error('错误：未设置 MOWEN_API_KEY。');
      console.error('');
      console.error('请先运行以下命令配置 API Key：');
      console.error('  md-to-mowen config');
      console.error('');
      console.error('获取方式：微信小程序"墨问" → 个人主页 → 开发者 → 我的 API Key');
      process.exit(1);
    }

    const client = new MowenClient(apiKey ?? 'dry-run-placeholder');
    const tags = opts.tags ? (opts.tags as string).split(',').map((t: string) => t.trim()) : undefined;

    // ── 元数据：自动查找已有 noteId ──────────────────────────────────────────────
    const absInput = resolve(opts.input);
    const metaPath = findMetadataPath();
    const metaStore = readMetadata(metaPath);

    let noteId: string | undefined = opts.noteId;

    if (!noteId && !opts.dryRun) {
      const existing = lookupNote(metaStore, absInput);
      if (existing) {
        noteId = existing.noteId;
        console.log(`  找到已有笔记映射，进入编辑模式：${noteId}`);
      }
    }

    try {
      const result = await processFile(opts.input, client, {
        ...(noteId ? { noteId } : {}),
        ...(tags ? { tags } : {}),
        autoPublish: opts.autoPublish,
        dryRun: opts.dryRun,
        ...(opts.cacheDir ? { cacheDir: opts.cacheDir } : {}),
      });

      if (!result.dryRun && result.noteId) {
        upsertNote(metaStore, absInput, result.noteId);
        await writeMetadata(metaPath, metaStore);
      }

      if (!result.dryRun) {
        console.log(`\n✅ 发布成功`);
        console.log(`   笔记 ID：${result.noteId}`);
        console.log(`   访问地址：${result.noteUrl}\n`);
      }
    } catch (err) {
      console.error('发布失败：', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── to-markdown ────────────────────────────────────────────────────────────────

program
  .command('to-markdown')
  .description('将 NoteAtom JSON 转换为 Markdown')
  .requiredOption('-i, --input <file>', 'NoteAtom JSON 文件路径')
  .option('-o, --output <file>', '输出 Markdown 文件路径（不指定则输出到 stdout）')
  .action(async (opts) => {
    try {
      const raw = (await import('fs/promises')).readFile;
      const data = await raw(opts.input, 'utf8');
      const noteAtom = JSON.parse(data);

      if (!noteAtom.type || !Array.isArray(noteAtom.content)) {
        console.error('错误：无效的 NoteAtom JSON，缺少 type 或 content 字段。');
        process.exit(1);
      }

      const mast = noteAtomToMast(noteAtom);
      const md = mastToMarkdown(mast);

      if (opts.output) {
        await (await import('fs/promises')).writeFile(opts.output, md, 'utf8');
        console.log(`✅ 已输出到 ${opts.output}`);
      } else {
        process.stdout.write(md);
      }
    } catch (err) {
      console.error('转换失败：', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
