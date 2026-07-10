import { describe, it, expect, beforeEach } from 'vitest';
import { mastToNoteAtom } from '../../src/noteatom/from-mast.js';
import type { MASTDocument } from '../../src/mast/types.js';
import type {
  NoteAtomParagraph,
  NoteAtomQuote,
  NoteAtomImage,
  NoteAtomAudio,
} from '../../src/noteatom/types.js';

function makeDoc(blocks: Record<string, any>, topLevel: string[]): MASTDocument {
  return { blocks, topLevel } as MASTDocument;
}

describe('段落序列化', () => {
  it('普通文本 → paragraph + text node', () => {
    const doc = makeDoc(
      { b_1: { id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: 'hello' }] } },
      ['b_1']
    );
    const na = mastToNoteAtom(doc);
    expect(na.type).toBe('doc');
    expect(na.content).toHaveLength(1);
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.type).toBe('paragraph');
    expect(p.content[0].text).toBe('hello');
    expect(p.content[0].marks).toBeUndefined();
  });

  it('空段落 → paragraph with empty content', () => {
    const doc = makeDoc({ b_1: { id: 'b_1', type: 'paragraph', content: [] } }, ['b_1']);
    const na = mastToNoteAtom(doc);
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content).toHaveLength(0);
  });
});

describe('行内标记序列化', () => {
  function paraWithMarks(marks: Record<string, any>) {
    return makeDoc(
      {
        b_1: {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'text', marks }],
        },
      },
      ['b_1']
    );
  }

  it('bold → { type: "bold" }', () => {
    const na = mastToNoteAtom(paraWithMarks({ bold: true }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({ type: 'bold' });
  });

  it('italic → { type: "italic" }', () => {
    const na = mastToNoteAtom(paraWithMarks({ italic: true }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({ type: 'italic' });
  });

  it('code → { type: "code" }', () => {
    const na = mastToNoteAtom(paraWithMarks({ code: true }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({ type: 'code' });
  });

  it('strikethrough → { type: "strikethrough" }', () => {
    const na = mastToNoteAtom(paraWithMarks({ strikethrough: true }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({ type: 'strikethrough' });
  });

  it('highlight → { type: "highlight" }', () => {
    const na = mastToNoteAtom(paraWithMarks({ highlight: true }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({ type: 'highlight' });
  });

  it('link → { type: "link", attrs: { href } }', () => {
    const na = mastToNoteAtom(paraWithMarks({ link: 'https://example.com' }));
    const p = na.content[0] as NoteAtomParagraph;
    expect(p.content[0].marks).toContainEqual({
      type: 'link',
      attrs: { href: 'https://example.com' },
    });
  });

  it('bold + italic 同时存在', () => {
    const na = mastToNoteAtom(paraWithMarks({ bold: true, italic: true }));
    const p = na.content[0] as NoteAtomParagraph;
    const types = p.content[0].marks!.map((m) => m.type);
    expect(types).toContain('bold');
    expect(types).toContain('italic');
  });

  it('标记顺序：code → strikethrough → bold → italic → highlight → link', () => {
    const na = mastToNoteAtom(
      paraWithMarks({
        bold: true,
        italic: true,
        code: true,
        strikethrough: true,
        highlight: true,
        link: 'https://x.com',
      })
    );
    const p = na.content[0] as NoteAtomParagraph;
    const types = p.content[0].marks!.map((m) => m.type);
    expect(types).toEqual(['code', 'strikethrough', 'bold', 'italic', 'highlight', 'link']);
  });
});

describe('引用块序列化', () => {
  it('quote → NoteAtomQuote with inline text children', () => {
    const doc = makeDoc(
      {
        b_q: {
          id: 'b_q',
          type: 'quote',
          children: ['b_p'],
        },
        b_p: {
          id: 'b_p',
          type: 'paragraph',
          content: [{ type: 'text', text: '引用内容' }],
        },
      },
      ['b_q']
    );
    const na = mastToNoteAtom(doc);
    const q = na.content[0] as NoteAtomQuote;
    expect(q.type).toBe('quote');
    expect(q.content).toHaveLength(1);
    expect(q.content[0].type).toBe('text');
    expect(q.content[0].text).toBe('引用内容');
  });

  it('多段 quote → text 数组，段间用 \\n 分隔', () => {
    const doc = makeDoc(
      {
        b_q: { id: 'b_q', type: 'quote', children: ['b_p1', 'b_p2'] },
        b_p1: { id: 'b_p1', type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
        b_p2: { id: 'b_p2', type: 'paragraph', content: [{ type: 'text', text: '第二段' }] },
      },
      ['b_q']
    );
    const na = mastToNoteAtom(doc);
    const q = na.content[0] as NoteAtomQuote;
    expect(q.content.map((n) => n.text)).toEqual(['第一段', '\n', '第二段']);
  });
});

describe('图片序列化', () => {
  it('image with uuid → NoteAtomImage', () => {
    const doc = makeDoc(
      {
        b_img: {
          id: 'b_img',
          type: 'image',
          src: 'https://example.com/img.png',
          uuid: 'file-id-abc',
          alt: '图片',
          align: 'center',
        },
      },
      ['b_img']
    );
    const na = mastToNoteAtom(doc);
    const img = na.content[0] as NoteAtomImage;
    expect(img.type).toBe('image');
    expect(img.attrs.uuid).toBe('file-id-abc');
    expect(img.attrs.alt).toBe('图片');
    expect(img.attrs.align).toBe('center');
  });

  it('image without uuid → throws', () => {
    const doc = makeDoc(
      {
        b_img: {
          id: 'b_img',
          type: 'image',
          src: 'https://example.com/img.png',
          alt: '图片',
          align: 'center',
        },
      },
      ['b_img']
    );
    expect(() => mastToNoteAtom(doc)).toThrow('no uuid');
  });
});

describe('音频序列化', () => {
  it('audio with uuid → NoteAtomAudio', () => {
    const doc = makeDoc(
      {
        b_audio: {
          id: 'b_audio',
          type: 'audio',
          src: './assets/test.mp3',
          uuid: 'audio-file-id',
          showNote: '00:00 开场\n01:00 结尾',
        },
      },
      ['b_audio']
    );
    const na = mastToNoteAtom(doc);
    const audio = na.content[0] as NoteAtomAudio;
    expect(audio.type).toBe('audio');
    expect(audio.attrs['audio-uuid']).toBe('audio-file-id');
    expect(audio.attrs['show-note']).toBe('00:00 开场\n01:00 结尾');
  });

  it('audio without uuid → throws', () => {
    const doc = makeDoc(
      {
        b_audio: {
          id: 'b_audio',
          type: 'audio',
          src: './assets/test.mp3',
          showNote: '',
        },
      },
      ['b_audio']
    );
    expect(() => mastToNoteAtom(doc)).toThrow('no uuid');
  });

  it('show-note 为空字符串时正常序列化', () => {
    const doc = makeDoc(
      {
        b_audio: {
          id: 'b_audio',
          type: 'audio',
          src: './assets/test.mp3',
          uuid: 'audio-id',
          showNote: '',
        },
      },
      ['b_audio']
    );
    const na = mastToNoteAtom(doc);
    const audio = na.content[0] as NoteAtomAudio;
    expect(audio.attrs['show-note']).toBe('');
  });
});

describe('综合文档', () => {
  it('混合块顺序保持一致（含音频）', () => {
    const doc = makeDoc(
      {
        b_1: { id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: '标题' }] },
        b_2: { id: 'b_2', type: 'quote', children: ['b_3'] },
        b_3: { id: 'b_3', type: 'paragraph', content: [{ type: 'text', text: '引用' }] },
        b_4: {
          id: 'b_4',
          type: 'image',
          src: 'x',
          uuid: 'uuid-1',
          alt: '',
          align: 'center',
        },
        b_5: {
          id: 'b_5',
          type: 'audio',
          src: 'y',
          uuid: 'audio-uuid-1',
          showNote: '00:00 开始',
        },
      },
      ['b_1', 'b_2', 'b_4', 'b_5']
    );
    const na = mastToNoteAtom(doc);
    expect(na.content[0].type).toBe('paragraph');
    expect(na.content[1].type).toBe('quote');
    expect(na.content[2].type).toBe('image');
    expect(na.content[3].type).toBe('audio');
  });
});
