import { describe, it, expect } from 'vitest';
import { noteAtomToMast } from '../../src/noteatom/to-mast.js';
import type { NoteAtomDoc } from '../../src/noteatom/types.js';
import type {
  MASTParagraphBlock,
  MASTQuoteBlock,
  MASTImageBlock,
  MASTAudioBlock,
} from '../../src/mast/types.js';

function topBlocks(doc: ReturnType<typeof noteAtomToMast>) {
  return doc.topLevel.map((id) => doc.blocks[id]);
}

// ── 段落 ───────────────────────────────────────────────────────────────────────

describe('NoteAtom → MAST 段落', () => {
  it('纯文本段落', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };
    const mast = noteAtomToMast(na);
    const p = topBlocks(mast)[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
    expect(p.content[0].text).toBe('Hello');
    expect(p.content[0].marks).toBeUndefined();
  });

  it('带 bold 标记', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const p = topBlocks(mast)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.bold).toBe(true);
  });

  it('带 link 标记', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href: 'https://x.com' } }],
            },
          ],
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const p = topBlocks(mast)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.link).toBe('https://x.com');
  });

  it('空段落', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    };
    const mast = noteAtomToMast(na);
    const p = topBlocks(mast)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(0);
  });
});

// ── 引用块 ─────────────────────────────────────────────────────────────────────

describe('NoteAtom → MAST 引用块', () => {
  it('引用块 → MASTQuoteBlock', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'quote',
          content: [{ type: 'text', text: '引用内容' }],
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const q = topBlocks(mast)[0] as MASTQuoteBlock;
    expect(q.type).toBe('quote');
    expect(q.children).toHaveLength(1);
    const child = mast.blocks[q.children[0]] as MASTParagraphBlock;
    expect(child.type).toBe('paragraph');
    expect(child.content[0].text).toBe('引用内容');
  });

  it('多行引用 → 按 \\n 拆成多个子段落', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'quote',
          content: [
            { type: 'text', text: '第一行' },
            { type: 'text', text: '\n' },
            { type: 'text', text: '第二行' },
          ],
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const q = topBlocks(mast)[0] as MASTQuoteBlock;
    expect(q.children).toHaveLength(2);
    const first = mast.blocks[q.children[0]] as MASTParagraphBlock;
    expect(first.content[0].text).toBe('第一行');
    const second = mast.blocks[q.children[1]] as MASTParagraphBlock;
    expect(second.content[0].text).toBe('第二行');
  });
});

// ── 图片 ───────────────────────────────────────────────────────────────────────

describe('NoteAtom → MAST 图片', () => {
  it('图片 → MASTImageBlock', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { uuid: 'abc-123', alt: 'test img', align: 'center' },
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const img = topBlocks(mast)[0] as MASTImageBlock;
    expect(img.type).toBe('image');
    expect(img.uuid).toBe('abc-123');
    expect(img.alt).toBe('test img');
    expect(img.align).toBe('center');
    expect(img.src).toContain('abc-123');
  });
});

// ── 音频 ───────────────────────────────────────────────────────────────────────

describe('NoteAtom → MAST 音频', () => {
  it('音频 → MASTAudioBlock', () => {
    const na: NoteAtomDoc = {
      type: 'doc',
      content: [
        {
          type: 'audio',
          attrs: { 'audio-uuid': 'mp3-001', 'show-note': '00:00 开场' },
        },
      ],
    };
    const mast = noteAtomToMast(na);
    const audio = topBlocks(mast)[0] as MASTAudioBlock;
    expect(audio.type).toBe('audio');
    expect(audio.uuid).toBe('mp3-001');
    expect(audio.showNote).toBe('00:00 开场');
  });
});
