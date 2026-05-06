import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readMetadata,
  writeMetadata,
  lookupNote,
  upsertNote,
  findMetadataPath,
  type MetadataStore,
} from '../../src/shared/metadata.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `meta-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ── readMetadata ─────────────────────────────────────────────────────────────

describe('readMetadata', () => {
  it('文件不存在时返回空 store', () => {
    const store = readMetadata(join(testDir, 'nope.json'));
    expect(store).toEqual({ version: 1, notes: {} });
  });

  it('正常读取已有元数据', async () => {
    const filePath = join(testDir, 'metadata.json');
    const data: MetadataStore = {
      version: 1,
      notes: {
        '/path/to/file.md': { noteId: 'abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
      },
    };
    await writeFile(filePath, JSON.stringify(data), 'utf8');

    const store = readMetadata(filePath);
    expect(store.notes['/path/to/file.md']?.noteId).toBe('abc');
  });

  it('JSON 损坏时返回空 store 并打印警告', async () => {
    const filePath = join(testDir, 'bad.json');
    await writeFile(filePath, '{ broken json!!!', 'utf8');

    const consoleSpy = { warn: console.warn };
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
    expect(warnings.some((w) => w.includes('解析失败'))).toBe(true);

    console.warn = consoleSpy.warn;
  });

  it('version 字段缺失时返回空 store', async () => {
    const filePath = join(testDir, 'no-version.json');
    await writeFile(filePath, JSON.stringify({ notes: {} }), 'utf8');

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
  });

  it('notes 字段非对象时返回空 store', async () => {
    const filePath = join(testDir, 'wrong-type.json');
    await writeFile(filePath, JSON.stringify({ version: 1, notes: 'bad' }), 'utf8');

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
  });

  // ── 备份恢复测试 ────────────────────────────────────────────────────────────

  it('metadata.json 损坏时从 .bak 恢复', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 正常数据写入 .bak
    const validData: MetadataStore = {
      version: 1,
      notes: {
        '/valid.md': { noteId: 'valid-id', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      },
    };
    await writeFile(bakPath, JSON.stringify(validData), 'utf8');

    // 损坏主文件
    await writeFile(filePath, '{ corrupted!!!', 'utf8');

    const consoleSpy = { warn: console.warn };
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const store = readMetadata(filePath);
    expect(store.notes['/valid.md']?.noteId).toBe('valid-id');
    expect(warnings.some((w) => w.includes('备份恢复'))).toBe(true);

    console.warn = consoleSpy.warn;
  });

  it('两者都损坏时创建空 metadata', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    await writeFile(filePath, '{ corrupted!!!', 'utf8');
    await writeFile(bakPath, '{ also corrupted!!!', 'utf8');

    const consoleSpy = { warn: console.warn };
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
    expect(warnings.some((w) => w.includes('解析失败'))).toBe(true);

    console.warn = consoleSpy.warn;
  });

  it('.bak 文件不存在时，主文件损坏返回空 store', async () => {
    const filePath = join(testDir, 'metadata.json');
    await writeFile(filePath, '{ corrupted!!!', 'utf8');

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
  });
});

// ── writeMetadata ────────────────────────────────────────────────────────────

describe('writeMetadata', () => {
  it('写入并能重新读取', async () => {
    const filePath = join(testDir, 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/a.md', 'id-1');

    await writeMetadata(filePath, store);

    const reloaded = readMetadata(filePath);
    expect(reloaded.notes['/a.md']?.noteId).toBe('id-1');
  });

  it('自动创建目录', async () => {
    const filePath = join(testDir, 'deep', 'nested', 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };

    await writeMetadata(filePath, store);

    const content = await readFile(filePath, 'utf8');
    expect(JSON.parse(content).version).toBe(1);
  });

  // ── 原子写入与备份测试 ──────────────────────────────────────────────────────

  it('正常写入后 metadata.json 和 .bak 内容正确', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 第一次写入（无 .bak）
    const store1: MetadataStore = { version: 1, notes: {} };
    upsertNote(store1, '/first.md', 'id-1');
    await writeMetadata(filePath, store1);

    // 第一次写入后不应该有 .bak
    const bakContent1 = await readFile(bakPath, 'utf8').catch(() => null);
    expect(bakContent1).toBeNull();

    // 第二次写入
    const store2: MetadataStore = { version: 1, notes: {} };
    upsertNote(store2, '/second.md', 'id-2');
    await writeMetadata(filePath, store2);

    // 第二次写入后应该有 .bak，内容为第一次的数据
    const bakContent2 = JSON.parse(await readFile(bakPath, 'utf8'));
    expect(bakContent2.notes['/first.md']?.noteId).toBe('id-1');

    // 主文件内容应为第二次的数据
    const mainContent = JSON.parse(await readFile(filePath, 'utf8'));
    expect(mainContent.notes['/second.md']?.noteId).toBe('id-2');
  });

  it('tmp 写入失败不影响现有 metadata', async () => {
    const filePath = join(testDir, 'metadata.json');

    // 先写入正常数据
    const validData: MetadataStore = {
      version: 1,
      notes: {
        '/valid.md': { noteId: 'valid-id', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      },
    };
    await writeFile(filePath, JSON.stringify(validData), 'utf8');

    // 模拟 tmp 写入失败：创建一个无法写入的目录
    const tmpPath = filePath + '.tmp';
    await mkdir(tmpPath, { recursive: true }); // tmpPath 是目录，无法作为文件写入

    try {
      const newStore: MetadataStore = { version: 1, notes: {} };
      upsertNote(newStore, '/new.md', 'new-id');
      await writeMetadata(filePath, newStore);
      // 应该抛出错误
      expect(true).toBe(false); // 不应该到达这里
    } catch {
      // 预期的错误
    }

    // 原文件应该保持不变
    const mainContent = JSON.parse(await readFile(filePath, 'utf8'));
    expect(mainContent.notes['/valid.md']?.noteId).toBe('valid-id');

    // 清理 tmp 目录
    await rm(tmpPath, { recursive: true, force: true });
  });

  it('不保留多个历史版本（只保留一个 .bak）', async () => {
    const filePath = join(testDir, 'metadata.json');

    // 连续写入三次
    for (let i = 1; i <= 3; i++) {
      const store: MetadataStore = { version: 1, notes: {} };
      upsertNote(store, `/file${i}.md`, `id-${i}`);
      await writeMetadata(filePath, store);
    }

    // 最终 .bak 应该只保存第二次写入的内容（第三次写入前的状态）
    const bakPath = filePath + '.bak';
    const bakContent = JSON.parse(await readFile(bakPath, 'utf8'));
    expect(bakContent.notes['/file2.md']?.noteId).toBe('id-2');
    expect(bakContent.notes['/file3.md']).toBeUndefined();

    // 主文件应为第三次写入的内容
    const mainContent = JSON.parse(await readFile(filePath, 'utf8'));
    expect(mainContent.notes['/file3.md']?.noteId).toBe('id-3');
  });
});

// ── lookupNote ───────────────────────────────────────────────────────────────

describe('lookupNote', () => {
  it('找到已有记录', () => {
    const store: MetadataStore = {
      version: 1,
      notes: {
        '/a.md': { noteId: 'x', createdAt: '', updatedAt: '' },
      },
    };
    expect(lookupNote(store, '/a.md')).toEqual({ noteId: 'x', createdAt: '', updatedAt: '' });
  });

  it('找不到时返回 undefined', () => {
    const store: MetadataStore = { version: 1, notes: {} };
    expect(lookupNote(store, '/missing.md')).toBeUndefined();
  });
});

// ── upsertNote ──────────────────────────────────────────────────────────────

describe('upsertNote', () => {
  it('新增记录', () => {
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/new.md', 'id-new');

    expect(store.notes['/new.md']?.noteId).toBe('id-new');
    expect(store.notes['/new.md']?.createdAt).toBeTruthy();
    expect(store.notes['/new.md']?.createdAt).toBe(store.notes['/new.md']?.updatedAt);
  });

  it('更新已有记录，保留 createdAt', () => {
    const store: MetadataStore = {
      version: 1,
      notes: {
        '/existing.md': { noteId: 'old-id', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      },
    };

    upsertNote(store, '/existing.md', 'new-id');

    expect(store.notes['/existing.md']?.noteId).toBe('new-id');
    expect(store.notes['/existing.md']?.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(store.notes['/existing.md']?.updatedAt).not.toBe('2026-01-01T00:00:00Z');
  });
});

// ── findMetadataPath ────────────────────────────────────────────────────────

describe('findMetadataPath', () => {
  it('项目级存在时优先返回项目级', async () => {
    const projectDir = join(testDir, 'project');
    const userDir = join(testDir, 'user');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await mkdir(join(userDir, '.md-to-mowen'), { recursive: true });
    await writeFile(join(projectDir, '.md-to-mowen', 'metadata.json'), '{}', 'utf8');
    await writeFile(join(userDir, '.md-to-mowen', 'metadata.json'), '{}', 'utf8');

    // findMetadataPath 不直接支持自定义 user home，这里只验证项目级优先
    const path = findMetadataPath(projectDir);
    expect(path).toContain('project');
  });

  it('项目级不存在时返回项目级路径（待创建）', () => {
    const projectDir = join(testDir, 'empty-project');
    const path = findMetadataPath(projectDir);
    expect(path).toContain('empty-project');
  });
});
