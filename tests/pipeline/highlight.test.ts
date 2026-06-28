import { describe, it, expect, beforeEach } from 'vitest';
import { mdToHast } from '../../src/pipeline/md-to-hast.js';
import { hastToMast, _resetIdCounter } from '../../src/pipeline/hast-to-mast.js';
import { mastToNoteAtom } from '../../src/noteatom/from-mast.js';
import { noteAtomToMast } from '../../src/noteatom/to-mast.js';
import { mastToMarkdown } from '../../src/mast/to-markdown.js';
import type { MASTTextRun } from '../../src/mast/types.js';
import type { NoteAtomTextNode } from '../../src/noteatom/types.js';

beforeEach(() => {
  _resetIdCounter();
});

// ── Markdown → MAST ──────────────────────────────────────────────────────────

describe('highlight: Markdown → MAST', () => {
  it('==高亮== 生成 highlight 标记', () => {
    const hast = mdToHast('这是 ==高亮文本== 测试');
    const { doc } = hastToMast(hast);
    const block = doc.topLevel.map((id) => doc.blocks[id])[0] as { content: MASTTextRun[] };
    const highlightRun = block.content.find((r) => r.marks?.highlight);
    expect(highlightRun).toBeDefined();
    expect(highlightRun!.text).toBe('高亮文本');
  });

  it('高亮可与加粗组合', () => {
    const hast = mdToHast('==**粗体高亮**==');
    const { doc } = hastToMast(hast);
    const block = doc.topLevel.map((id) => doc.blocks[id])[0] as { content: MASTTextRun[] };
    const run = block.content.find((r) => r.text.includes('粗体高亮'));
    expect(run).toBeDefined();
    expect(run!.marks?.highlight).toBe(true);
    expect(run!.marks?.bold).toBe(true);
  });

  it('无高亮时不含 highlight 标记', () => {
    const hast = mdToHast('普通文本');
    const { doc } = hastToMast(hast);
    const block = doc.topLevel.map((id) => doc.blocks[id])[0] as { content: MASTTextRun[] };
    expect(block.content.every((r) => !r.marks?.highlight)).toBe(true);
  });
});

// ── MAST → NoteAtom ──────────────────────────────────────────────────────────

describe('highlight: MAST → NoteAtom', () => {
  it('highlight 标记转为 NoteAtom highlight mark', () => {
    const hast = mdToHast('==高亮==');
    const { doc } = hastToMast(hast);
    const noteAtom = mastToNoteAtom(doc);
    const para = noteAtom.content[0] as { content: NoteAtomTextNode[] };
    const highlightNode = para.content.find((n) => n.marks?.some((m) => m.type === 'highlight'));
    expect(highlightNode).toBeDefined();
    expect(highlightNode!.text).toBe('高亮');
  });
});

// ── NoteAtom → MAST ──────────────────────────────────────────────────────────

describe('highlight: NoteAtom → MAST', () => {
  it('NoteAtom highlight mark 转为 MAST highlight', () => {
    const noteAtom = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph' as const,
          content: [{ type: 'text' as const, text: '高亮', marks: [{ type: 'highlight' as const }] }],
        },
      ],
    };
    const mast = noteAtomToMast(noteAtom);
    const block = mast.topLevel.map((id) => mast.blocks[id])[0] as { content: MASTTextRun[] };
    expect(block.content[0].marks?.highlight).toBe(true);
  });
});

// ── MAST → Markdown ──────────────────────────────────────────────────────────

describe('highlight: MAST → Markdown', () => {
  it('highlight 序列化为 ==text==', () => {
    const hast = mdToHast('==高亮==');
    const { doc } = hastToMast(hast);
    const md = mastToMarkdown(doc);
    expect(md).toContain('==高亮==');
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('highlight: round-trip', () => {
  it('Markdown → NoteAtom → Markdown 保持一致', () => {
    const original = '==高亮文本==';
    const hast = mdToHast(original);
    const { doc } = hastToMast(hast);
    const noteAtom = mastToNoteAtom(doc);
    const mast2 = noteAtomToMast(noteAtom);
    const md = mastToMarkdown(mast2);
    expect(md).toContain('==高亮文本==');
  });
});
