import { describe, it, expect } from 'vitest';
import { mastToMarkdown } from '../../src/mast/to-markdown.js';
import type { MASTDocument, MASTBlockId, MASTBlockNode } from '../../src/mast/types.js';

function makeDoc(blocks: MASTBlockNode[]): MASTDocument {
  const blockMap: Record<MASTBlockId, MASTBlockNode> = {};
  const topLevel: MASTBlockId[] = [];
  for (const b of blocks) {
    blockMap[b.id] = b;
    topLevel.push(b.id);
  }
  return { blocks: blockMap, topLevel };
}

// ── 段落 ───────────────────────────────────────────────────────────────────────

describe('MAST → Markdown 段落', () => {
  it('纯文本', () => {
    const md = mastToMarkdown(
      makeDoc([{ id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }])
    );
    expect(md).toBe('Hello');
  });

  it('粗体', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'bold', marks: { bold: true } }],
        },
      ])
    );
    expect(md).toBe('**bold**');
  });

  it('斜体', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'italic', marks: { italic: true } }],
        },
      ])
    );
    expect(md).toBe('*italic*');
  });

  it('行内代码', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'code', marks: { code: true } }],
        },
      ])
    );
    expect(md).toBe('`code`');
  });

  it('删除线', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'strike', marks: { strikethrough: true } }],
        },
      ])
    );
    expect(md).toBe('~~strike~~');
  });

  it('链接', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'click', marks: { link: 'https://example.com' } }],
        },
      ])
    );
    expect(md).toBe('[click](https://example.com)');
  });

  it('粗体 + 链接 → 链接包裹粗体', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'paragraph',
          content: [
            { type: 'text', text: 'link bold', marks: { bold: true, link: 'https://x.com' } },
          ],
        },
      ])
    );
    expect(md).toBe('[**link bold**](https://x.com)');
  });

  it('多段落 → 空行分隔', () => {
    const md = mastToMarkdown(
      makeDoc([
        { id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
        { id: 'b_2', type: 'paragraph', content: [{ type: 'text', text: '第二段' }] },
      ])
    );
    expect(md).toBe('第一段\n\n第二段');
  });
});

// ── 引用块 ─────────────────────────────────────────────────────────────────────

describe('MAST → Markdown 引用块', () => {
  it('简单引用', () => {
    const doc = makeDoc([]);
    const quoteBlock: any = { id: 'b_1', type: 'quote', children: ['b_2'] };
    const innerBlock: any = {
      id: 'b_2',
      type: 'paragraph',
      content: [{ type: 'text', text: '引用内容' }],
    };
    doc.blocks[quoteBlock.id] = quoteBlock;
    doc.blocks[innerBlock.id] = innerBlock;
    doc.topLevel.push(quoteBlock.id);

    const md = mastToMarkdown(doc);
    expect(md).toBe('> 引用内容');
  });

  it('多行引用', () => {
    const doc = makeDoc([]);
    const quoteBlock: any = { id: 'b_1', type: 'quote', children: ['b_2', 'b_3'] };
    const c1: any = { id: 'b_2', type: 'paragraph', content: [{ type: 'text', text: '第一行' }] };
    const c2: any = { id: 'b_3', type: 'paragraph', content: [{ type: 'text', text: '第二行' }] };
    doc.blocks[quoteBlock.id] = quoteBlock;
    doc.blocks[c1.id] = c1;
    doc.blocks[c2.id] = c2;
    doc.topLevel.push(quoteBlock.id);

    const md = mastToMarkdown(doc);
    expect(md).toBe('> 第一行\n> 第二行');
  });
});

// ── 图片 ───────────────────────────────────────────────────────────────────────

describe('MAST → Markdown 图片', () => {
  it('图片 → ![alt](src)', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'image',
          src: './photo.jpg',
          alt: 'photo',
          align: 'center',
        },
      ])
    );
    expect(md).toBe('![photo](./photo.jpg)');
  });
});

// ── 音频 ───────────────────────────────────────────────────────────────────────

describe('MAST → Markdown 音频', () => {
  it('音频 → ![audio: showNote](src)', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'audio',
          src: './music.mp3',
          showNote: '00:00 开场',
        },
      ])
    );
    expect(md).toBe('![audio: 00:00 开场](./music.mp3)');
  });
});

describe('MAST → Markdown 标题', () => {
  it('heading → ATX # / ## / ###', () => {
    expect(
      mastToMarkdown(
        makeDoc([
          { id: 'b_1', type: 'heading', level: '1', content: [{ type: 'text', text: '一级' }] },
        ])
      )
    ).toBe('# 一级');
    expect(
      mastToMarkdown(
        makeDoc([
          { id: 'b_1', type: 'heading', level: '2', content: [{ type: 'text', text: '二级' }] },
        ])
      )
    ).toBe('## 二级');
    expect(
      mastToMarkdown(
        makeDoc([
          { id: 'b_1', type: 'heading', level: '3', content: [{ type: 'text', text: '三级' }] },
        ])
      )
    ).toBe('### 三级');
  });

  it('heading 不因标题本身包裹 **', () => {
    const md = mastToMarkdown(
      makeDoc([
        { id: 'b_1', type: 'heading', level: '1', content: [{ type: 'text', text: '标题' }] },
      ])
    );
    expect(md).toBe('# 标题');
    expect(md).not.toContain('**');
  });

  it('heading 内行内 code 序列化为反引号', () => {
    const md = mastToMarkdown(
      makeDoc([
        {
          id: 'b_1',
          type: 'heading',
          level: '1',
          content: [
            { type: 'text', text: '标题 ' },
            { type: 'text', text: 'code', marks: { code: true } },
          ],
        },
      ])
    );
    expect(md).toBe('# 标题 `code`');
  });
});

// ── 空段落（分隔线）────────────────────────────────────────────────────────────

describe('MAST → Markdown 空段落', () => {
  it('空段落输出空行', () => {
    const md = mastToMarkdown(
      makeDoc([
        { id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: '上面' }] },
        { id: 'b_2', type: 'paragraph', content: [] },
        { id: 'b_3', type: 'paragraph', content: [{ type: 'text', text: '下面' }] },
      ])
    );
    expect(md).toBe('上面\n\n下面');
  });

  it('连续空段落合并为单个空行', () => {
    const md = mastToMarkdown(
      makeDoc([
        { id: 'b_1', type: 'paragraph', content: [{ type: 'text', text: '上面' }] },
        { id: 'b_2', type: 'paragraph', content: [] },
        { id: 'b_3', type: 'paragraph', content: [] },
        { id: 'b_4', type: 'paragraph', content: [{ type: 'text', text: '下面' }] },
      ])
    );
    expect(md).toBe('上面\n\n下面');
  });
});
