import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const METADATA_FILENAME = 'metadata.json';
const TMP_SUFFIX = '.tmp';
const BAK_SUFFIX = '.bak';
const LOCK_SUFFIX = '.lock';

const LOCK_EXPIRE_MS = 30_000; // 锁过期时间：30秒
const LOCK_WAIT_MS = 5_000; // 等待锁的最大时间：5秒
const LOCK_RETRY_MS = 100; // 重试间隔：100毫秒

export interface NoteRecord {
  noteId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataStore {
  version: 1;
  notes: Record<string, NoteRecord>;
}

function emptyStore(): MetadataStore {
  return { version: 1, notes: {} };
}

/**
 * 查找元数据文件路径（项目级优先于用户级）。
 * 项目级：CWD/.md-to-mowen/metadata.json
 * 用户级：~/.md-to-mowen/metadata.json
 */
export function findMetadataPath(
  projectRoot?: string,
  _exists: (p: string) => boolean = existsSync
): string {
  const projectDir = projectRoot ?? process.cwd();
  const projectPath = join(projectDir, '.md-to-mowen', METADATA_FILENAME);
  const userPath = join(homedir(), '.md-to-mowen', METADATA_FILENAME);

  if (_exists(projectPath)) return projectPath;
  if (_exists(userPath)) return userPath;
  // 默认写入项目级
  return projectPath;
}

/** 尝试解析元数据文件，返回解析结果或 null */
function tryParseMetadata(filePath: string): MetadataStore | null {
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (data && typeof data === 'object' && data.version === 1 && typeof data.notes === 'object') {
      return data as MetadataStore;
    }

    return null;
  } catch {
    return null;
  }
}

/** 读取元数据，文件不存在或损坏时返回空 store */
export function readMetadata(filePath: string): MetadataStore {
  // 优先尝试读取主文件
  const mainData = tryParseMetadata(filePath);
  if (mainData) return mainData;

  // 主文件不存在或损坏，尝试读取备份
  const bakPath = filePath + BAK_SUFFIX;
  const bakData = tryParseMetadata(bakPath);
  if (bakData) {
    console.warn(`警告：元数据文件损坏，已从备份恢复：${filePath}`);
    return bakData;
  }

  // 主文件和备份都不存在或都损坏
  if (existsSync(filePath)) {
    console.warn(`警告：元数据文件及备份均损坏，已重新创建：${filePath}`);
  }
  return emptyStore();
}

/** 原子写入元数据：先写临时文件，fsync 后再 rename */
export function writeMetadata(filePath: string, store: MetadataStore): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpPath = filePath + TMP_SUFFIX;
  const bakPath = filePath + BAK_SUFFIX;
  const content = JSON.stringify(store, null, 2) + '\n';

  // 1. 写入临时文件
  let fd: number | undefined;
  try {
    fd = openSync(tmpPath, 'w');
    writeSync(fd, content, 0, 'utf8');
    // 2. fsync 确保落盘
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;

    // 3. 将现有文件重命名为备份（如果存在）
    if (existsSync(filePath)) {
      // 删除旧备份（不累积历史版本）
      if (existsSync(bakPath)) {
        unlinkSync(bakPath);
      }
      renameSync(filePath, bakPath);
    }

    // 4. 将临时文件重命名为正式文件
    renameSync(tmpPath, filePath);
  } finally {
    // 确保 fd 被关闭（如果中途出错）
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    // 清理临时文件（如果写入失败且临时文件残留）
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }
}

/** 根据绝对路径查找已有记录 */
export function lookupNote(store: MetadataStore, absPath: string): NoteRecord | undefined {
  return store.notes[absPath];
}

/** 更新或新增一条记录 */
export function upsertNote(store: MetadataStore, absPath: string, noteId: string): void {
  const now = new Date().toISOString();
  const existing = store.notes[absPath];

  if (existing) {
    store.notes[absPath] = { ...existing, noteId, updatedAt: now };
  } else {
    store.notes[absPath] = { noteId, createdAt: now, updatedAt: now };
  }
}

// ── 文件锁机制 ─────────────────────────────────────────────────────────────

export interface LockInfo {
  pid: number;
  createdAt: string;
}

/** 创建锁文件信息 */
function createLockInfo(): LockInfo {
  return {
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
}

/** 解析锁文件，损坏时返回 null */
function parseLockFile(lockPath: string): LockInfo | null {
  if (!existsSync(lockPath)) return null;

  try {
    const raw = readFileSync(lockPath, 'utf8');
    const data = JSON.parse(raw);

    if (
      data &&
      typeof data === 'object' &&
      typeof data.pid === 'number' &&
      typeof data.createdAt === 'string'
    ) {
      return data as LockInfo;
    }

    return null;
  } catch {
    return null;
  }
}

/** 检查锁是否过期 */
function isLockExpired(lockInfo: LockInfo): boolean {
  const lockTime = new Date(lockInfo.createdAt).getTime();
  const now = Date.now();
  return now - lockTime > LOCK_EXPIRE_MS;
}

/** 等待并获取锁 */
async function acquireLock(lockPath: string): Promise<void> {
  const startTime = Date.now();

  while (true) {
    const existingLock = parseLockFile(lockPath);

    if (!existingLock) {
      // 无锁或锁文件损坏，尝试创建锁
      try {
        const lockInfo = createLockInfo();
        const dir = dirname(lockPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(lockPath, JSON.stringify(lockInfo), 'utf8');
        return; // 成功获取锁
      } catch {
        // 写入失败，可能被其他进程抢先，继续重试
      }
    } else if (isLockExpired(existingLock)) {
      // 锁已过期，强制获取（删除旧锁）
      try {
        unlinkSync(lockPath);
        const lockInfo = createLockInfo();
        writeFileSync(lockPath, JSON.stringify(lockInfo), 'utf8');
        return; // 成功获取锁
      } catch {
        // 删除或写入失败，继续重试
      }
    } else {
      // 锁有效且未过期，继续等待
    }

    // 检查是否超时
    if (Date.now() - startTime > LOCK_WAIT_MS) {
      const holderPid = existingLock?.pid ?? 'unknown';
      const holderTime = existingLock?.createdAt ?? 'unknown';
      throw new Error(
        `获取文件锁超时（等待 ${LOCK_WAIT_MS}ms）。锁文件：${lockPath}，持有者 PID：${holderPid}，创建时间：${holderTime}`
      );
    }

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}

/** 释放锁 */
async function releaseLock(lockPath: string): Promise<void> {
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch {
    // 释放失败时忽略（可能是其他进程已删除）
  }
}

/** 异步读取元数据 */
export async function readMetadataAsync(filePath: string): Promise<MetadataStore> {
  return readMetadata(filePath);
}

/** 异步写入元数据 */
export async function writeMetadataAsync(filePath: string, store: MetadataStore): Promise<void> {
  return writeMetadata(filePath, store);
}

/**
 * 在锁保护下执行读-修改-写操作。
 * 整个过程加锁，保证原子性。
 *
 * @param filePath 元数据文件路径
 * @param operation 修改操作函数，接收当前 store，返回更新后的 store
 * @throws 锁等待超时时抛出错误
 */
export async function withLock(
  filePath: string,
  operation: (store: MetadataStore) => MetadataStore
): Promise<void> {
  const lockPath = filePath + LOCK_SUFFIX;

  await acquireLock(lockPath);
  try {
    const store = await readMetadataAsync(filePath);
    const updated = operation(store);
    await writeMetadataAsync(filePath, updated);
  } finally {
    await releaseLock(lockPath);
  }
}

/** 导出锁相关常量供测试使用 */
export const LOCK_CONSTANTS = {
  LOCK_EXPIRE_MS,
  LOCK_WAIT_MS,
  LOCK_RETRY_MS,
  LOCK_SUFFIX,
};
