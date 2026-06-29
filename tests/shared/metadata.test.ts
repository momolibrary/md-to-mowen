import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm, readFile, writeFile as writeFileAsync } from 'fs/promises';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readMetadata,
  writeMetadata,
  lookupNote,
  upsertNote,
  findMetadataPath,
  withLock,
  readMetadataAsync,
  writeMetadataAsync,
  LOCK_CONSTANTS,
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
        '/path/to/file.md': {
          noteId: 'abc',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
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
    expect(warnings.some((w) => w.includes('损坏'))).toBe(true);

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
});

// ── writeMetadata ────────────────────────────────────────────────────────────

describe('writeMetadata', () => {
  it('写入并能重新读取', async () => {
    const filePath = join(testDir, 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/a.md', 'id-1');

    writeMetadata(filePath, store);

    const reloaded = readMetadata(filePath);
    expect(reloaded.notes['/a.md']?.noteId).toBe('id-1');
  });

  it('自动创建目录', async () => {
    const filePath = join(testDir, 'deep', 'nested', 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };

    writeMetadata(filePath, store);

    const content = await readFile(filePath, 'utf8');
    expect(JSON.parse(content).version).toBe(1);
  });

  // 原子写入与备份测试
  it('正常写入后 metadata.json 和 metadata.json.bak 内容正确', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 第一次写入（没有现有文件）
    const store1: MetadataStore = { version: 1, notes: {} };
    upsertNote(store1, '/a.md', 'id-1');
    writeMetadata(filePath, store1);

    // 第一次写入后没有备份
    expect(existsSync(bakPath)).toBe(false);

    // 第二次写入（覆盖现有文件）
    const store2: MetadataStore = { version: 1, notes: {} };
    upsertNote(store2, '/b.md', 'id-2');
    writeMetadata(filePath, store2);

    // 第二次写入后应该有备份，内容是第一次写入的内容
    expect(existsSync(bakPath)).toBe(true);
    const bakContent = JSON.parse(await readFile(bakPath, 'utf8'));
    expect(bakContent.notes['/a.md']?.noteId).toBe('id-1');
    expect(bakContent.notes['/b.md']).toBeUndefined();

    // 主文件内容应该是第二次写入的内容
    const mainContent = JSON.parse(await readFile(filePath, 'utf8'));
    expect(mainContent.notes['/b.md']?.noteId).toBe('id-2');
    expect(mainContent.notes['/a.md']).toBeUndefined();
  });

  it('metadata.json 损坏时自动从 .bak 恟复', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 写入有效数据
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/a.md', 'id-1');
    writeMetadata(filePath, store);

    // 再次写入以创建备份
    const store2: MetadataStore = { version: 1, notes: {} };
    upsertNote(store2, '/a.md', 'id-2');
    writeMetadata(filePath, store2);

    // 模拟主文件损坏
    await writeFile(filePath, '{ broken json!!!', 'utf8');

    // 读取应该从备份恢复
    const consoleSpy = { warn: console.warn };
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const reloaded = readMetadata(filePath);
    expect(reloaded.notes['/a.md']?.noteId).toBe('id-1'); // 备份内容
    expect(warnings.some((w) => w.includes('备份恢复'))).toBe(true);

    console.warn = consoleSpy.warn;
  });

  it('两者都损坏时创建新的空 metadata', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 模拟主文件和备份都损坏
    await writeFile(filePath, '{ broken!!!', 'utf8');
    await writeFile(bakPath, '{ also broken!!!', 'utf8');

    const consoleSpy = { warn: console.warn };
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const store = readMetadata(filePath);
    expect(store).toEqual({ version: 1, notes: {} });
    expect(warnings.some((w) => w.includes('均损坏'))).toBe(true);

    console.warn = consoleSpy.warn;
  });

  it('不保留多个历史版本的 .bak', async () => {
    const filePath = join(testDir, 'metadata.json');
    const bakPath = filePath + '.bak';

    // 连续多次写入
    for (let i = 1; i <= 5; i++) {
      const store: MetadataStore = { version: 1, notes: {} };
      upsertNote(store, `/file${i}.md`, `id-${i}`);
      writeMetadata(filePath, store);
    }

    // 只应该有一个备份文件
    expect(existsSync(bakPath)).toBe(true);
    const bakContent = JSON.parse(await readFile(bakPath, 'utf8'));
    // 备份应该是第4次写入的内容（第5次覆盖前）
    expect(bakContent.notes['/file4.md']?.noteId).toBe('id-4');
    expect(bakContent.notes['/file5.md']).toBeUndefined();
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
        '/existing.md': {
          noteId: 'old-id',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
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

  it('项目级不存在且用户级也不存在时返回项目级路径（待创建）', () => {
    const projectDir = join(testDir, 'empty-project');
    const path = findMetadataPath(projectDir, () => false);
    expect(path).toContain('empty-project');
  });
});

// ── withLock (文件锁) ───────────────────────────────────────────────────────

describe('withLock', () => {
  const LOCK_SUFFIX = LOCK_CONSTANTS.LOCK_SUFFIX;

  it('两个并发写入不发生数据丢失', async () => {
    const filePath = join(testDir, 'metadata.json');

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 模拟两个并发写入：同时添加不同的记录
    const task1 = withLock(filePath, (store) => {
      upsertNote(store, '/file1.md', 'note-1');
      return store;
    });

    const task2 = withLock(filePath, (store) => {
      upsertNote(store, '/file2.md', 'note-2');
      return store;
    });

    // 等待两个任务完成
    await Promise.all([task1, task2]);

    // 验证两个记录都存在，没有数据丢失
    const result = readMetadata(filePath);
    expect(result.notes['/file1.md']?.noteId).toBe('note-1');
    expect(result.notes['/file2.md']?.noteId).toBe('note-2');
  });

  it('进程崩溃后残留锁不会永久阻塞', async () => {
    const filePath = join(testDir, 'metadata.json');
    const lockPath = filePath + LOCK_SUFFIX;

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 创建一个过期锁（模拟进程崩溃残留）
    const expiredLockTime = new Date(
      Date.now() - LOCK_CONSTANTS.LOCK_EXPIRE_MS - 1000
    ).toISOString();
    await writeFile(lockPath, JSON.stringify({ pid: 99999, createdAt: expiredLockTime }), 'utf8');

    // 尝试写入，应该能成功获取过期锁
    await withLock(filePath, (store) => {
      upsertNote(store, '/test.md', 'note-test');
      return store;
    });

    // 验证写入成功
    const result = readMetadata(filePath);
    expect(result.notes['/test.md']?.noteId).toBe('note-test');

    // 锁文件应该被释放
    expect(existsSync(lockPath)).toBe(false);
  });

  it('等待超时后 fast fail 并提示原因', async () => {
    const filePath = join(testDir, 'metadata.json');
    const lockPath = filePath + LOCK_SUFFIX;

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 创建一个有效的锁（未过期）
    const validLockTime = new Date().toISOString();
    await writeFile(lockPath, JSON.stringify({ pid: 12345, createdAt: validLockTime }), 'utf8');

    // 尝试写入，应该超时失败
    // 测试超时需要比锁等待时间长（锁等待5秒，测试需要10秒）
    try {
      await withLock(filePath, (store) => {
        upsertNote(store, '/test.md', 'note-test');
        return store;
      });
      // 如果没有抛错，测试失败
      expect.fail('应该抛出超时错误');
    } catch (err) {
      expect(err instanceof Error).toBe(true);
      expect((err as Error).message).toContain('获取文件锁超时');
      expect((err as Error).message).toContain('12345');
    }

    // 锁文件应该仍然存在（未被删除）
    expect(existsSync(lockPath)).toBe(true);
  }, 10000); // 测试超时设置为 10 秒

  it('锁文件损坏时视为过期锁', async () => {
    const filePath = join(testDir, 'metadata.json');
    const lockPath = filePath + LOCK_SUFFIX;

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 创建损坏的锁文件
    await writeFile(lockPath, '{ broken json!!!', 'utf8');

    // 尝试写入，应该能成功获取锁（损坏视为不存在/过期）
    await withLock(filePath, (store) => {
      upsertNote(store, '/test.md', 'note-test');
      return store;
    });

    // 验证写入成功
    const result = readMetadata(filePath);
    expect(result.notes['/test.md']?.noteId).toBe('note-test');
  });

  it('整体加锁保证读-修改-写原子性', async () => {
    const filePath = join(testDir, 'metadata.json');

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 在 withLock 中进行读-修改-写
    await withLock(filePath, (store) => {
      // 读取已有数据
      const existing = lookupNote(store, '/existing.md');
      expect(existing).toBeUndefined(); // 初始无数据

      // 修改
      upsertNote(store, '/existing.md', 'note-1');
      upsertNote(store, '/new.md', 'note-2');

      // 返回修改后的 store
      return store;
    });

    // 验证修改成功
    const result = readMetadata(filePath);
    expect(result.notes['/existing.md']?.noteId).toBe('note-1');
    expect(result.notes['/new.md']?.noteId).toBe('note-2');
  });

  it('操作完成后删除锁文件', async () => {
    const filePath = join(testDir, 'metadata.json');
    const lockPath = filePath + LOCK_SUFFIX;

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 执行写入
    await withLock(filePath, (store) => {
      upsertNote(store, '/test.md', 'note-test');
      return store;
    });

    // 锁文件应该被删除
    expect(existsSync(lockPath)).toBe(false);
  });

  it('操作失败时也删除锁文件（finally 保证释放）', async () => {
    const filePath = join(testDir, 'metadata.json');
    const lockPath = filePath + LOCK_SUFFIX;

    // 初始化空文件
    const initialStore: MetadataStore = { version: 1, notes: {} };
    writeMetadata(filePath, initialStore);

    // 执行一个会抛出错误的操作
    try {
      await withLock(filePath, () => {
        throw new Error('操作失败');
      });
    } catch (err) {
      expect((err as Error).message).toBe('操作失败');
    }

    // 即使操作失败，锁文件也应该被删除
    expect(existsSync(lockPath)).toBe(false);
  });
});

// ── async versions ─────────────────────────────────────────────────────────

describe('readMetadataAsync', () => {
  it('异步读取元数据', async () => {
    const filePath = join(testDir, 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/async.md', 'async-note');
    writeMetadata(filePath, store);

    const result = await readMetadataAsync(filePath);
    expect(result.notes['/async.md']?.noteId).toBe('async-note');
  });
});

describe('writeMetadataAsync', () => {
  it('异步写入元数据', async () => {
    const filePath = join(testDir, 'metadata.json');
    const store: MetadataStore = { version: 1, notes: {} };
    upsertNote(store, '/async.md', 'async-note');

    await writeMetadataAsync(filePath, store);

    const result = readMetadata(filePath);
    expect(result.notes['/async.md']?.noteId).toBe('async-note');
  });
});
