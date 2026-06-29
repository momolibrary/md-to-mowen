import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { processFile } from '../../src/publish/process-file.js';
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

// ── 测试用 Markdown 文件 ───────────────────────────────────────────────────────

async function writeTempMd(content: string): Promise<string> {
  const path = join(tmpdir(), `test-${Date.now()}.md`);
  await writeFile(path, content, 'utf8');
  return path;
}

// ── dry-run 基础 ──────────────────────────────────────────────────────────────

describe('dry-run 模式', () => {
  it('不调用 createNote / editNote', async () => {
    const client = makeClient();
    const path = await writeTempMd('# 标题\n\n普通段落。');

    const result = await processFile(path, client, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.noteId).toBeUndefined();
    expect(result.noteUrl).toBeUndefined();
    expect(client.createNote).not.toHaveBeenCalled();
    expect(client.editNote).not.toHaveBeenCalled();
  });

  it('stats 正确统计段落数（含空段落）', async () => {
    const client = makeClient();
    const path = await writeTempMd('段落一\n\n段落二\n\n段落三');

    const result = await processFile(path, client, { dryRun: true });

    expect(result.stats.paragraphs).toBe(5); // 3 段落 + 2 空段落
    expect(result.stats.uploadedAssets).toBe(0);
  });

  it('含图片时 stats.images 正确，但 uploadedAssets=0', async () => {
    const client = makeClient();
    const path = await writeTempMd('![img](https://example.com/img.png)\n\n段落');

    const result = await processFile(path, client, { dryRun: true });

    expect(result.stats.images).toBe(1);
    expect(result.stats.uploadedAssets).toBe(0);
    expect(client.uploadViaUrl).not.toHaveBeenCalled();
  });

  it('含表格时 stats.tables 正确', async () => {
    const client = makeClient();
    const path = await writeTempMd('| A | B |\n|---|---|\n| 1 | 2 |');

    const result = await processFile(path, client, { dryRun: true });

    expect(result.stats.tables).toBe(1);
    expect(result.stats.uploadedAssets).toBe(0);
  });
});

// ── 正式发布 ──────────────────────────────────────────────────────────────────

describe('正式发布', () => {
  it('创建新笔记，返回 noteId 和 noteUrl', async () => {
    const client = makeClient();
    const path = await writeTempMd('# 标题\n\n内容');

    const result = await processFile(path, client, { dryRun: false });

    expect(result.dryRun).toBe(false);
    expect(result.noteId).toBe('note-id-abc');
    expect(result.noteUrl).toBe('https://note.mowen.cn/detail/note-id-abc');
    expect(client.createNote).toHaveBeenCalledOnce();
  });

  it('编辑已有笔记（noteId 指定）', async () => {
    const client = makeClient();
    const path = await writeTempMd('更新内容');

    const result = await processFile(path, client, { dryRun: false, noteId: 'existing-note' });

    expect(client.editNote).toHaveBeenCalledWith('existing-note', expect.any(Object));
    expect(client.createNote).not.toHaveBeenCalled();
    expect(result.noteId).toBe('existing-note');
  });

  it('含远程图片时调用 uploadViaUrl', async () => {
    const client = makeClient();
    const path = await writeTempMd('![img](https://example.com/photo.jpg)');

    const result = await processFile(path, client, { dryRun: false });

    expect(client.uploadViaUrl).toHaveBeenCalledWith(1, 'https://example.com/photo.jpg');
    expect(result.stats.uploadedAssets).toBe(1);
  });
});

// ── cache-dir ─────────────────────────────────────────────────────────────────

describe('cache-dir', () => {
  it('写入 02-mast.json 和 04-noteatom.json', async () => {
    const client = makeClient();
    const path = await writeTempMd('# 标题\n\n内容');
    const cacheDir = join(tmpdir(), `cache-${Date.now()}`);

    await processFile(path, client, { dryRun: true, cacheDir });

    const mastJson = JSON.parse(await readFile(join(cacheDir, '02-mast.json'), 'utf8'));
    const naJson = JSON.parse(await readFile(join(cacheDir, '04-noteatom.json'), 'utf8'));

    expect(mastJson).toHaveProperty('blocks');
    expect(naJson).toHaveProperty('type', 'doc');
  });
});
