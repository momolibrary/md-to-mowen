import { describe, it, expect, beforeEach } from 'vitest';
import { mdToHast } from '../../src/pipeline/md-to-hast.js';
import { hastToMast, _resetIdCounter } from '../../src/pipeline/hast-to-mast.js';
import { mastToNoteAtom } from '../../src/noteatom/from-mast.js';
import { noteAtomToMast } from '../../src/noteatom/to-mast.js';
import { mastToMarkdown } from '../../src/mast/to-markdown.js';
import type { MASTPdfBlock } from '../../src/mast/types.js';

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

describe('pdf 块: Markdown → MAST', () => {
  it('![[pdf:path]] 生成 pdf 块', () => {
    const block = getFirstBlock('![[pdf:./doc.pdf]]') as MASTPdfBlock;
    expect(block.type).toBe('pdf');
    expect(block.src).toBe('./doc.pdf');
  });

  it('![[pdf:fileId]] 生成 pdf 块（已上传文件）', () => {
    const block = getFirstBlock('![[pdf:abc123-TMP]]') as MASTPdfBlock;
    expect(block.type).toBe('pdf');
    expect(block.src).toBe('abc123-TMP');
    expect(block.uuid).toBe('abc123-TMP');
  });

  it('普通段落不生成 pdf 块', () => {
    const block = getFirstBlock('普通文本');
    expect(block!.type).toBe('paragraph');
  });
});

// ── MAST → NoteAtom ──────────────────────────────────────────────────────────

describe('pdf 块: MAST → NoteAtom', () => {
  it('有 uuid 的 MASTPdfBlock 转为 NoteAtomPdf', () => {
    const hast = mdToHast('![[pdf:abc123-TMP]]');
    const { doc } = hastToMast(hast);
    const noteAtom = mastToNoteAtom(doc);
    const pdfNode = noteAtom.content[0] as { type: string; attrs: { uuid: string } };
    expect(pdfNode.type).toBe('pdf');
    expect(pdfNode.attrs.uuid).toBe('abc123-TMP');
  });

  it('无 uuid 时抛出错误', () => {
    const hast = mdToHast('![[pdf:./doc.pdf]]');
    const { doc } = hastToMast(hast);
    expect(() => mastToNoteAtom(doc)).toThrow('no uuid');
  });
});

// ── NoteAtom → MAST ──────────────────────────────────────────────────────────

describe('pdf 块: NoteAtom → MAST', () => {
  it('NoteAtomPdf 转为 MASTPdfBlock', () => {
    const noteAtom = {
      type: 'doc' as const,
      content: [
        {
          type: 'pdf' as const,
          attrs: { uuid: 'abc123' },
        },
      ],
    };
    const mast = noteAtomToMast(noteAtom);
    const block = mast.topLevel.map((id) => mast.blocks[id])[0] as MASTPdfBlock;
    expect(block.type).toBe('pdf');
    expect(block.uuid).toBe('abc123');
  });
});

// ── MAST → Markdown ──────────────────────────────────────────────────────────

describe('pdf 块: MAST → Markdown', () => {
  it('pdf 块序列化为 ![[pdf:src]]', () => {
    const hast = mdToHast('![[pdf:./doc.pdf]]');
    const { doc } = hastToMast(hast);
    const md = mastToMarkdown(doc);
    expect(md).toContain('![[pdf:./doc.pdf]]');
  });
});
