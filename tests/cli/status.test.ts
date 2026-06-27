import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { MetadataStore } from '../../src/shared/metadata.js';
import { listAllNotes, lookupFileStatus, formatStatusTable, formatStatusJson } from '../../src/cli/status.js';

// ── 测试数据 ────────────────────────────────────────────────────────────────

function makeStore(notes: Record<string, { noteId: string; createdAt: string; updatedAt: string }>): MetadataStore {
  return { version: 1, notes };
}

const NOW = '2026-06-28T12:00:00.000Z';
const YESTERDAY = '2026-06-27T12:00:00.000Z';

// ── listAllNotes ────────────────────────────────────────────────────────────

describe('listAllNotes', () => {
  it('空 store 返回空数组', () => {
    const store = makeStore({});
    expect(listAllNotes(store, '/project')).toEqual([]);
  });

  it('返回所有记录，路径转为相对路径', () => {
    const store = makeStore({
      '/project/posts/article.md': { noteId: 'abc123', createdAt: YESTERDAY, updatedAt: NOW },
      '/project/posts/draft.md': { noteId: 'def456', createdAt: NOW, updatedAt: NOW },
    });
    const entries = listAllNotes(store, '/project');
    expect(entries).toHaveLength(2);
    expect(entries[0].file).toBe('posts/article.md');
    expect(entries[0].noteId).toBe('abc123');
    expect(entries[1].file).toBe('posts/draft.md');
    expect(entries[1].noteId).toBe('def456');
  });

  it('包含正确的 noteUrl', () => {
    const store = makeStore({
      '/project/test.md': { noteId: 'xyz', createdAt: NOW, updatedAt: NOW },
    });
    const entries = listAllNotes(store, '/project');
    expect(entries[0].noteUrl).toBe('https://mowen.cn/note/xyz');
  });

  it('保留 createdAt 和 updatedAt', () => {
    const store = makeStore({
      '/project/test.md': { noteId: 'id1', createdAt: YESTERDAY, updatedAt: NOW },
    });
    const entries = listAllNotes(store, '/project');
    expect(entries[0].createdAt).toBe(YESTERDAY);
    expect(entries[0].updatedAt).toBe(NOW);
  });
});

// ── lookupFileStatus ────────────────────────────────────────────────────────

describe('lookupFileStatus', () => {
  it('命中时返回 StatusEntry', () => {
    const store = makeStore({
      '/project/article.md': { noteId: 'abc', createdAt: YESTERDAY, updatedAt: NOW },
    });
    const entry = lookupFileStatus(store, '/project/article.md', '/project');
    expect(entry).not.toBeNull();
    expect(entry!.file).toBe('article.md');
    expect(entry!.noteId).toBe('abc');
    expect(entry!.noteUrl).toBe('https://mowen.cn/note/abc');
  });

  it('未命中时返回 null', () => {
    const store = makeStore({});
    const entry = lookupFileStatus(store, '/project/missing.md', '/project');
    expect(entry).toBeNull();
  });

  it('路径转为相对路径', () => {
    const store = makeStore({
      '/project/deep/nested/file.md': { noteId: 'id', createdAt: NOW, updatedAt: NOW },
    });
    const entry = lookupFileStatus(store, '/project/deep/nested/file.md', '/project');
    expect(entry!.file).toBe('deep/nested/file.md');
  });
});

// ── formatStatusTable ───────────────────────────────────────────────────────

describe('formatStatusTable', () => {
  it('空数组显示暂无记录提示', () => {
    const output = formatStatusTable([]);
    expect(output).toContain('暂无已发布笔记');
  });

  it('包含表头', () => {
    const entries = [
      { file: 'test.md', noteId: 'abc', noteUrl: 'https://mowen.cn/note/abc', createdAt: NOW, updatedAt: NOW },
    ];
    const output = formatStatusTable(entries);
    expect(output).toContain('文件');
    expect(output).toContain('笔记 ID');
    expect(output).toContain('更新时间');
  });

  it('包含文件路径和 noteId', () => {
    const entries = [
      {
        file: 'posts/article.md',
        noteId: 'abc123',
        noteUrl: 'https://mowen.cn/note/abc123',
        createdAt: YESTERDAY,
        updatedAt: NOW,
      },
    ];
    const output = formatStatusTable(entries);
    expect(output).toContain('posts/article.md');
    expect(output).toContain('abc123');
    expect(output).toContain('https://mowen.cn/note/abc123');
  });

  it('多个条目正确对齐', () => {
    const entries = [
      { file: 'a.md', noteId: 'id1', noteUrl: 'https://mowen.cn/note/id1', createdAt: NOW, updatedAt: NOW },
      { file: 'b.md', noteId: 'id2', noteUrl: 'https://mowen.cn/note/id2', createdAt: NOW, updatedAt: NOW },
    ];
    const output = formatStatusTable(entries);
    expect(output).toContain('a.md');
    expect(output).toContain('b.md');
    expect(output).toContain('id1');
    expect(output).toContain('id2');
  });
});

// ── formatStatusJson ────────────────────────────────────────────────────────

describe('formatStatusJson', () => {
  it('输出合法 JSON', () => {
    const entries = [
      { file: 'test.md', noteId: 'abc', noteUrl: 'https://mowen.cn/note/abc', createdAt: NOW, updatedAt: NOW },
    ];
    const output = formatStatusJson(entries);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].noteId).toBe('abc');
  });

  it('空数组输出空 JSON 数组', () => {
    const output = formatStatusJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
