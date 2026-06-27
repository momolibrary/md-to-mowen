import { relative } from 'path';
import type { MetadataStore, NoteRecord } from '../shared/metadata.js';

const MOWEN_NOTE_BASE_URL = 'https://mowen.cn/note';

export interface StatusEntry {
  file: string;
  noteId: string;
  noteUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** 将 NoteRecord 转为 StatusEntry，路径转为相对于 cwd 的相对路径 */
function toEntry(absPath: string, record: NoteRecord, cwd: string): StatusEntry {
  return {
    file: relative(cwd, absPath),
    noteId: record.noteId,
    noteUrl: `${MOWEN_NOTE_BASE_URL}/${record.noteId}`,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** 列出所有已发布文件 */
export function listAllNotes(store: MetadataStore, cwd: string): StatusEntry[] {
  return Object.entries(store.notes).map(([absPath, record]) => toEntry(absPath, record, cwd));
}

/** 查询单个文件的发布状态，未发布返回 null */
export function lookupFileStatus(store: MetadataStore, absPath: string, cwd: string): StatusEntry | null {
  const record = store.notes[absPath];
  if (!record) return null;
  return toEntry(absPath, record, cwd);
}

/** 格式化为表格文本 */
export function formatStatusTable(entries: StatusEntry[]): string {
  if (entries.length === 0) {
    return '暂无已发布笔记。';
  }

  // 计算列宽
  const fileWidth = Math.max(6, ...entries.map((e) => e.file.length));
  const idWidth = Math.max(8, ...entries.map((e) => e.noteId.length));

  const header = `${'文件'.padEnd(fileWidth)}  ${'笔记 ID'.padEnd(idWidth)}  更新时间`;
  const divider = `${'─'.repeat(fileWidth)}  ${'─'.repeat(idWidth)}  ${'─'.repeat(24)}`;

  const rows = entries.map((e) => {
    const time = e.updatedAt.replace('T', ' ').replace(/\.\d{3}Z$/, '');
    return `${e.file.padEnd(fileWidth)}  ${e.noteId.padEnd(idWidth)}  ${time}`;
  });

  const links = entries.map((e) => `  → ${e.noteUrl}`);

  return [header, divider, ...rows, '', ...links].join('\n');
}

/** 格式化为 JSON */
export function formatStatusJson(entries: StatusEntry[]): string {
  return JSON.stringify(entries, null, 2) + '\n';
}
