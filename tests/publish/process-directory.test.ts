import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, symlink, lstat } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { scanMarkdownFiles, processDirectory } from '../../src/publish/process-directory.js';
import type { MowenClient } from '../../src/mowen/client.js';

// mock table-renderer
vi.mock('../../src/publish/table-renderer.js', () => ({
  renderTableToPng: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
}));

// mock fetch for OSS upload
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

function makeClient(overrides: Partial<MowenClient> = {}): MowenClient {
  return {
    uploadPrepare: vi.fn().mockResolvedValue({
      endpoint: 'https://oss.example.com/',
      key: 'k',
      policy: 'p',
      callback: 'c',
      success_action_status: '200',
      'x-oss-credential': 'cred',
      'x-oss-date': 'date',
      'x-oss-meta-mo-uid': 'uid',
      'x-oss-signature': 'sig',
      'x-oss-signature-version': 'OSS4-HMAC-SHA256',
      'x:file_id': 'file-id-123',
      'x:file_name': 'img.png',
      'x:file_uid': 'uid',
    }),
    uploadViaUrl: vi.fn().mockResolvedValue('remote-file-id'),
    createNote: vi.fn().mockResolvedValue('note-id-abc'),
    editNote: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as MowenClient;
}

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `batch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ── scanMarkdownFiles ───────────────────────────────────────────────────────

describe('scanMarkdownFiles', () => {
  it('收集当前目录的 .md 文件', async () => {
    await writeFile(join(testDir, 'a.md'), '# A', 'utf8');
    await writeFile(join(testDir, 'b.md'), '# B', 'utf8');
    await writeFile(join(testDir, 'c.txt'), 'text', 'utf8');

    const files = await scanMarkdownFiles(testDir, false);

    expect(files.length).toBe(2);
    expect(files.every((f) => f.endsWith('.md'))).toBe(true);
  });

  it('按文件名排序', async () => {
    await writeFile(join(testDir, 'z.md'), '# Z', 'utf8');
    await writeFile(join(testDir, 'a.md'), '# A', 'utf8');
    await writeFile(join(testDir, 'm.md'), '# M', 'utf8');

    const files = await scanMarkdownFiles(testDir, false);
    const names = files.map((f) => basename(f));

    expect(names).toEqual(['a.md', 'm.md', 'z.md']);
  });

  it('跳过隐藏文件（.开头）', async () => {
    await writeFile(join(testDir, '.hidden.md'), '# Hidden', 'utf8');
    await writeFile(join(testDir, 'visible.md'), '# Visible', 'utf8');

    const files = await scanMarkdownFiles(testDir, false);

    expect(files.length).toBe(1);
    expect(files[0]).toContain('visible.md');
  });

  it('跳过符号链接', async () => {
    const target = join(testDir, 'target.md');
    await writeFile(target, '# Target', 'utf8');
    await symlink(target, join(testDir, 'link.md'));

    const files = await scanMarkdownFiles(testDir, false);

    expect(files.length).toBe(1);
    expect(files[0]).toBe(target);
  });

  it('递归扫描子目录', async () => {
    await writeFile(join(testDir, 'root.md'), '# Root', 'utf8');
    await mkdir(join(testDir, 'sub'));
    await writeFile(join(testDir, 'sub', 'child.md'), '# Child', 'utf8');

    const files = await scanMarkdownFiles(testDir, true);

    expect(files.length).toBe(2);
    expect(files.some((f) => f.includes('child.md'))).toBe(true);
  });

  it('--no-recursive 只处理当前层', async () => {
    await writeFile(join(testDir, 'root.md'), '# Root', 'utf8');
    await mkdir(join(testDir, 'sub'));
    await writeFile(join(testDir, 'sub', 'child.md'), '# Child', 'utf8');

    const files = await scanMarkdownFiles(testDir, false);

    expect(files.length).toBe(1);
    expect(files[0]).toContain('root.md');
  });

  it('空目录返回空数组', async () => {
    const files = await scanMarkdownFiles(testDir, true);
    expect(files).toEqual([]);
  });
});

// ── processDirectory ───────────────────────────────────────────────────────

describe('processDirectory', () => {
  it('批量发布多个文件', async () => {
    const client = makeClient();
    await writeFile(join(testDir, 'a.md'), '# A', 'utf8');
    await writeFile(join(testDir, 'b.md'), '# B', 'utf8');

    const result = await processDirectory(testDir, client, { dryRun: true });

    expect(result.total).toBe(2);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('单文件失败不阻断后续', async () => {
    const client = makeClient({
      createNote: vi.fn().mockImplementation(async (body) => {
        // 模拟 a.md 失败，b.md 成功
        const noteAtom = body as { content: unknown[] };
        const firstBlock = noteAtom.content[0] as { content?: { text?: string }[] };
        const text = firstBlock?.content?.[0]?.text ?? '';
        if (text.includes('A')) {
          throw new Error('模拟失败');
        }
        return 'note-id-success';
      }),
    });

    await writeFile(join(testDir, 'a.md'), '# A', 'utf8');
    await writeFile(join(testDir, 'b.md'), '# B', 'utf8');

    const result = await processDirectory(testDir, client, { dryRun: false });

    expect(result.total).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.files[0].status).toBe('failed');
    expect(result.files[1].status).toBe('success');
  });

  it('空目录返回全零统计并打印提示', async () => {
    const client = makeClient();

    const result = await processDirectory(testDir, client, { dryRun: true });

    expect(result.total).toBe(0);
    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('传入文件路径抛出错误', async () => {
    const client = makeClient();
    const filePath = join(testDir, 'single.md');
    await writeFile(filePath, '# Single', 'utf8');

    await expect(processDirectory(filePath, client)).rejects.toThrow('路径不是目录');
  });

  it('目录不存在时抛出错误', async () => {
    const client = makeClient();
    const nonExist = join(testDir, 'non-exist');

    await expect(processDirectory(nonExist, client)).rejects.toThrow();
  });
});
