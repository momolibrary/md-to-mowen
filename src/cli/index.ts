#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { lstat } from 'fs/promises';
import { processFile } from '../publish/process-file.js';
import { processDirectory } from '../publish/process-directory.js';
import { MowenClient, Visibility } from '../mowen/client.js';
import { noteAtomToMast } from '../noteatom/to-mast.js';
import { mastToMarkdown } from '../mast/to-markdown.js';
import { findMetadataPath, readMetadata, writeMetadata, lookupNote, upsertNote } from '../shared/metadata.js';
import { loadConfig, type MdToMowenConfig } from '../shared/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 从 package.json 读取版本号
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

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

program.name('md-to-mowen').description('将 Markdown（GFM）转换为墨问笔记').version(VERSION);

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
  .requiredOption('-i, --input <path>', 'Markdown 文件路径或目录')
  .option('--note-id <id>', '已有笔记 ID（编辑模式，全量替换）')
  .option('--tags <tags>', '标签，逗号分隔（如 "tech,ai"），覆盖配置文件 defaultTags')
  .option('--auto-publish', '自动发布（非草稿），覆盖配置文件 autoPublish', false)
  .option('--dry-run', '走完流水线但不调用墨问 API，仅打印统计', false)
  .option('--cache-dir <dir>', '保存各阶段产物的目录（调试用）')
  .option('--code-block-style <style>', '代码块样式：paragraph 或 codeblock')
  .option('--no-recursive', '批量发布时不递归扫描子目录', false)
  .option('--quiet', '静默模式：抑制进度条，仅输出最终汇总', false)
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

    // ── 加载配置 ────────────────────────────────────────────────────────────────
    const absInput = resolve(opts.input);
    const inputDir = dirname(absInput);
    const cliOverrides: Partial<MdToMowenConfig> = {};

    // CLI 参数优先级最高，仅当明确提供时才覆盖配置
    if (opts.tags !== undefined) {
      cliOverrides.defaultTags = opts.tags;
    }
    if (opts.autoPublish) {
      cliOverrides.autoPublish = true;
    }
    if (opts.cacheDir) {
      cliOverrides.cacheDir = opts.cacheDir;
    }
    if (opts.codeBlockStyle) {
      const style = opts.codeBlockStyle as string;
      if (style === 'paragraph' || style === 'codeblock') {
        cliOverrides.codeBlockStyle = style;
      } else {
        console.error(`错误：--code-block-style="${style}" 无效，支持：paragraph, codeblock`);
        process.exit(1);
      }
    }

    const resolvedConfig = loadConfig(cliOverrides, inputDir);

    const client = new MowenClient(apiKey ?? 'dry-run-placeholder');
    // 使用 resolvedConfig.defaultTags（可能来自配置文件），但 CLI --tags 覆盖时优先使用
    const tagsStr = opts.tags !== undefined ? opts.tags : resolvedConfig.defaultTags;
    const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : undefined;

    // ── 检测 input 类型 ───────────────────────────────────────────────────────
    try {
      const inputStat = await lstat(absInput);

      if (inputStat.isDirectory()) {
        // 目录：批量处理
        const result = await processDirectory(opts.input, client, {
          ...(tags ? { tags } : {}),
          autoPublish: resolvedConfig.autoPublish,
          dryRun: opts.dryRun,
          cacheDir: resolvedConfig.cacheDir,
          recursive: !opts.noRecursive,
          quiet: opts.quiet,
        });

        // 批量模式下，有失败则 exit 1
        if (result.failed > 0) {
          process.exit(1);
        }
      } else if (inputStat.isFile()) {
        // 单文件：现有逻辑
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
            autoPublish: resolvedConfig.autoPublish,
            dryRun: opts.dryRun,
            cacheDir: resolvedConfig.cacheDir,
            codeBlockStyle: resolvedConfig.codeBlockStyle,
            quiet: opts.quiet,
          });

          if (!result.dryRun && result.noteId) {
            upsertNote(metaStore, absInput, result.noteId);
            writeMetadata(metaPath, metaStore);
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
      } else {
        console.error(`错误：路径不存在 ${absInput}`);
        process.exit(1);
      }
    } catch (err) {
      // lstat 抛错（如路径不存在）
      console.error('错误：', err instanceof Error ? err.message : err);
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

// ── privacy ────────────────────────────────────────────────────────────────────

program
  .command('privacy')
  .description('设置笔记的隐私状态')
  .option('--note-id <id>', '笔记 ID')
  .option('-i, --input <file>', 'Markdown 文件路径（需要元数据支持）')
  .requiredOption('--visibility <visibility>', '隐私状态：public 或 private')
  .option('--dry-run', '不调用 API，仅打印操作信息', false)
  .action(async (opts) => {
    if (!opts.noteId && !opts.input) {
      console.error('错误：必须提供 --note-id 或 --input');
      process.exit(1);
    }

    if (opts.noteId && opts.input) {
      console.error('错误：--note-id 和 --input 不能同时使用');
      process.exit(1);
    }

    const visibility = opts.visibility as string;
    if (visibility !== 'public' && visibility !== 'private') {
      console.error('错误：--visibility 必须是 public 或 private');
      process.exit(1);
    }

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

    let noteId: string;

    if (opts.input) {
      const absInput = resolve(opts.input);
      const metaPath = findMetadataPath();
      const metaStore = readMetadata(metaPath);
      const existing = lookupNote(metaStore, absInput);

      if (!existing) {
        console.error('错误：未找到该文件的元数据记录，请使用 --note-id 指定笔记 ID');
        process.exit(1);
      }

      noteId = existing.noteId;
      console.log(`  从元数据找到笔记 ID：${noteId}`);
    } else {
      noteId = opts.noteId as string;
    }

    if (opts.dryRun) {
      console.log(`\n[dry-run] 将设置笔记 ${noteId} 隐私状态为 ${visibility}`);
      return;
    }

    const client = new MowenClient(apiKey!);

    try {
      await client.setPrivacy(noteId, visibility as Visibility);
      console.log(`\n✅ 隐私设置成功`);
      console.log(`   笔记 ID：${noteId}`);
      console.log(`   隐私状态：${visibility}`);
      console.log(`   访问地址：https://mowen.cn/note/${noteId}\n`);
    } catch (err) {
      console.error('设置失败：', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── status ───────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('查看已发布笔记的状态')
  .option('-i, --input <path>', '查看指定文件的发布状态')
  .option('--json', '输出 JSON 格式')
  .action(async (opts) => {
    const metaPath = findMetadataPath();
    const metaStore = readMetadata(metaPath);
    const cwd = process.cwd();

    if (opts.input) {
      // 单文件查询
      const { lookupFileStatus, formatStatusTable, formatStatusJson } = await import('./status.js');
      const absInput = resolve(opts.input);
      const entry = lookupFileStatus(metaStore, absInput, cwd);

      if (!entry) {
        console.error(`未发布：${opts.input}（元数据中无记录）`);
        process.exit(1);
      }

      if (opts.json) {
        console.log(formatStatusJson([entry]));
      } else {
        console.log(formatStatusTable([entry]));
      }
    } else {
      // 列出所有
      const { listAllNotes, formatStatusTable, formatStatusJson } = await import('./status.js');
      const entries = listAllNotes(metaStore, cwd);

      if (opts.json) {
        console.log(formatStatusJson(entries));
      } else {
        console.log(formatStatusTable(entries));
      }
    }
  });

program.parse();
