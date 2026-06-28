import { describe, it, expect, beforeEach } from 'vitest';
import { mdToHast } from '../../src/pipeline/md-to-hast.js';
import { hastToMast, _resetIdCounter } from '../../src/pipeline/hast-to-mast.js';
import { mastToNoteAtom } from '../../src/noteatom/from-mast.js';
import { noteAtomToMast } from '../../src/noteatom/to-mast.js';
import { mastToMarkdown } from '../../src/mast/to-markdown.js';
import type { MASTNoteBlock } from '../../src/mast/types.js';

beforeEach(() => {
  _resetIdCounter();
});

function getFirstBlock(md: string) {
  const hast = mdToHast(md);
  const { doc } = hastToMast(hast);
  const id = doc.topLevel[0];
  return doc.blocks[id];
}

// ── Markdown → MAST ──────────────────────────────────────────────────────────

describe('note 块: Markdown → MAST', () => {
  it('![[note:noteId]] 生成 note 块', () => {
    const block = getFirstBlock('![[note:abc123]]') as MASTNoteBlock;
    expect(block.type).toBe('note');
    expect(block.noteId).toBe('abc123');
  });

  it('长 noteId 正确解析', () => {
    const block = getFirstBlock('![[note:LxZDJyK9pjJMHdtGhMsvC]]') as MASTNoteBlock;
    expect(block.type).toBe('note');
    expect(block.noteId).toBe('LxZDJyK9pjJMHdtGhMsvC');
  });

  it('普通段落不生成 note 块', () => {
    const block = getFirstBlock('普通文本');
    expect(block!.type).toBe('paragraph');
  });
});

// ── MAST → NoteAtom ──────────────────────────────────────────────────────────

describe('note 块: MAST → NoteAtom', () => {
  it('MASTNoteBlock 转为 NoteAtomNote', () => {
    const block = getFirstBlock('![[note:abc123]]') as MASTNoteBlock;
    const hast = mdToHast('![[note:abc123]]');
    const { doc } = hastToMast(hast);
    const noteAtom = mastToNoteAtom(doc);
    const noteNode = noteAtom.content[0] as { type: string; attrs: { uuid: string } };
    expect(noteNode.type).toBe('note');
    expect(noteNode.attrs.uuid).toBe('abc123');
  });
});

// ── NoteAtom → MAST ──────────────────────────────────────────────────────────

describe('note 块: NoteAtom → MAST', () => {
  it('NoteAtomNote 转为 MASTNoteBlock', () => {
    const noteAtom = {
      type: 'doc' as const,
      content: [
        {
          type: 'note' as const,
          attrs: { uuid: 'abc123' },
        },
      ],
    };
    const mast = noteAtomToMast(noteAtom);
    const block = mast.topLevel.map((id) => mast.blocks[id])[0] as MASTNoteBlock;
    expect(block.type).toBe('note');
    expect(block.noteId).toBe('abc123');
  });
});

// ── MAST → Markdown ──────────────────────────────────────────────────────────

describe('note 块: MAST → Markdown', () => {
  it('note 块序列化为 ![[note:noteId]]', () => {
    const hast = mdToHast('![[note:abc123]]');
    const { doc } = hastToMast(hast);
    const md = mastToMarkdown(doc);
    expect(md).toContain('![[note:abc123]]');
  });
});
