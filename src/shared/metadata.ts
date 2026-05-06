import { readFileSync, existsSync, mkdirSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const METADATA_FILENAME = 'metadata.json';
const TMP_SUFFIX = '.tmp';
const BAK_SUFFIX = '.bak';

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
export function findMetadataPath(projectRoot?: string): string {
  const projectDir = projectRoot ?? process.cwd();
  const projectPath = join(projectDir, '.md-to-mowen', METADATA_FILENAME);
  const userPath = join(homedir(), '.md-to-mowen', METADATA_FILENAME);

  if (existsSync(projectPath)) return projectPath;
  if (existsSync(userPath)) return userPath;
  // 默认写入项目级
  return projectPath;
}

/** 尝试从单个文件解析元数据 */
function tryParseFile(filePath: string): MetadataStore | null {
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

/** 读取元数据，主文件损坏时尝试 .bak 恢复，最终返回空 store */
export function readMetadata(filePath: string): MetadataStore {
  // 先尝试主文件
  const main = tryParseFile(filePath);
  if (main) return main;

  // 主文件失败，尝试 .bak
  const bakPath = filePath + BAK_SUFFIX;
  const bak = tryParseFile(bakPath);
  if (bak) {
    console.warn(`警告：元数据文件损坏，已从备份恢复：${bakPath}`);
    return bak;
  }

  // 两者都失败，返回空 store
  if (existsSync(filePath) || existsSync(bakPath)) {
    console.warn(`警告：元数据文件解析失败，已重新创建：${filePath}`);
  }
  return emptyStore();
}

/**
 * 原子写入元数据：
 * 1. 写入临时文件 .tmp
 * 2. fsync 确保落盘
 * 3. rename 现有文件 → .bak（macOS 原子）
 * 4. rename tmp → 主文件（原子）
 */
export async function writeMetadata(filePath: string, store: MetadataStore): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpPath = filePath + TMP_SUFFIX;
  const bakPath = filePath + BAK_SUFFIX;
  const content = JSON.stringify(store, null, 2) + '\n';

  // 1. 写入临时文件
  const tmpFile = await fsPromises.open(tmpPath, 'w');
  await tmpFile.writeFile(content, 'utf8');

  // 2. fsync 确保落盘
  await tmpFile.sync();
  await tmpFile.close();

  // 3. rename 现有文件 → .bak（如果存在）
  if (existsSync(filePath)) {
    await fsPromises.rename(filePath, bakPath);
  }

  // 4. rename tmp → 主文件
  await fsPromises.rename(tmpPath, filePath);
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
