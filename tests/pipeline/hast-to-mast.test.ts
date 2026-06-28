import { describe, it, expect, beforeEach } from 'vitest';
import { mdToHast } from '../../src/pipeline/md-to-hast.js';
import { hastToMast, _resetIdCounter, type ConversionWarning } from '../../src/pipeline/hast-to-mast.js';
import type {
  MASTDocument,
  MASTParagraphBlock,
  MASTQuoteBlock,
  MASTImageBlock,
  MASTAudioBlock,
  MASTCodeBlock,
} from '../../src/mast/types.js';

// 辅助：将 markdown 直接转为 MAST
function parse(md: string): MASTDocument {
  return hastToMast(mdToHast(md)).doc;
}

// 辅助：将 markdown 转为 MAST，带选项
function parseWithOptions(md: string, opts: { codeBlockStyle?: 'paragraph' | 'codeblock' }): MASTDocument {
  return hastToMast(mdToHast(md), opts).doc;
}

// 辅助：获取转换警告
function getWarnings(md: string): ConversionWarning[] {
  return hastToMast(mdToHast(md)).warnings;
}

// 辅助：获取顶层块列表
function topBlocks(doc: MASTDocument) {
  return doc.topLevel.map((id) => doc.blocks[id]);
}

beforeEach(() => {
  _resetIdCounter();
});

// ── 标题 ───────────────────────────────────────────────────────────────────────

describe('标题映射', () => {
  it('H1 → bold paragraph', () => {
    const doc = parse('# 一级标题');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const p = blocks[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
    expect(p.content[0].marks?.bold).toBe(true);
    expect(p.content[0].text).toBe('一级标题');
  });

  it('H2 → bold paragraph', () => {
    const doc = parse('## 二级标题');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.bold).toBe(true);
  });

  it('H3 → bold paragraph', () => {
    const doc = parse('### 三级标题');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.bold).toBe(true);
    expect(p.content[0].text).toBe('三级标题');
  });

  it('H4/H5/H6 → bold paragraph', () => {
    for (const md of ['#### H4', '##### H5', '###### H6']) {
      const doc = parse(md);
      const p = topBlocks(doc)[0] as MASTParagraphBlock;
      expect(p.content[0].marks?.bold).toBe(true);
    }
  });
});

// ── 行内标记 ───────────────────────────────────────────────────────────────────

describe('行内标记', () => {
  it('bold', () => {
    const doc = parse('**粗体**');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.bold).toBe(true);
    expect(p.content[0].text).toBe('粗体');
  });

  it('italic', () => {
    const doc = parse('*斜体*');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.italic).toBe(true);
  });

  it('inline code', () => {
    const doc = parse('`代码`');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.code).toBe(true);
  });

  it('strikethrough', () => {
    const doc = parse('~~删除线~~');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.strikethrough).toBe(true);
  });

  it('link', () => {
    const doc = parse('[文字](https://example.com)');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.link).toBe('https://example.com');
    expect(p.content[0].text).toBe('文字');
  });

  it('fragment link 被忽略', () => {
    const doc = parse('[锚点](#section)');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].marks?.link).toBeUndefined();
  });

  it('bold + italic 嵌套 → 合并标记', () => {
    const doc = parse('***粗斜体***');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    const run = p.content[0];
    expect(run.marks?.bold).toBe(true);
    expect(run.marks?.italic).toBe(true);
  });

  it('混合行内：普通 + bold + 普通', () => {
    const doc = parse('前 **粗** 后');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(3);
    expect(p.content[0].text).toBe('前 ');
    expect(p.content[1].marks?.bold).toBe(true);
    expect(p.content[2].text).toBe(' 后');
  });
});

// ── 段落 ───────────────────────────────────────────────────────────────────────

describe('段落', () => {
  it('普通段落', () => {
    const doc = parse('Hello world');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
    expect(p.content[0].text).toBe('Hello world');
  });

  it('多段落各自独立', () => {
    const doc = parse('第一段\n\n第二段');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('第一段');
    expect((blocks[1] as MASTParagraphBlock).content[0].text).toBe('第二段');
  });
});

// ── 分隔线 ─────────────────────────────────────────────────────────────────────

describe('分隔线', () => {
  it('--- → 空 paragraph', () => {
    const doc = parse('---');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
    expect(p.content).toHaveLength(0);
  });
});

// ── 列表 ───────────────────────────────────────────────────────────────────────

describe('无序列表', () => {
  it('每个 li → 带 • 前缀的 paragraph', () => {
    const doc = parse('- 苹果\n- 香蕉\n- 橙子');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      const p = b as MASTParagraphBlock;
      expect(p.type).toBe('paragraph');
      expect(p.content[0].text).toBe('• ');
    }
    expect((blocks[0] as MASTParagraphBlock).content[1].text).toBe('苹果');
  });

  it('嵌套列表 → 缩进前缀', () => {
    const doc = parse('- 父\n  - 子');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('• ');
    expect((blocks[1] as MASTParagraphBlock).content[0].text).toBe('  • ');
  });
});

describe('有序列表', () => {
  it('每个 li → 带 N. 前缀的 paragraph', () => {
    const doc = parse('1. 第一\n2. 第二\n3. 第三');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(3);
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('1. ');
    expect((blocks[1] as MASTParagraphBlock).content[0].text).toBe('2. ');
    expect((blocks[2] as MASTParagraphBlock).content[0].text).toBe('3. ');
  });
});

// ── 引用块 ─────────────────────────────────────────────────────────────────────

describe('引用块', () => {
  it('> quote → MASTQuoteBlock', () => {
    const doc = parse('> 引用内容');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const q = blocks[0] as MASTQuoteBlock;
    expect(q.type).toBe('quote');
    expect(q.children).toHaveLength(1);
    const inner = doc.blocks[q.children[0]] as MASTParagraphBlock;
    expect(inner.type).toBe('paragraph');
    expect(inner.content[0].text).toBe('引用内容');
  });

  it('多行引用 → 多个子段落', () => {
    const doc = parse('> 第一行\n>\n> 第二行');
    const q = topBlocks(doc)[0] as MASTQuoteBlock;
    expect(q.children.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 代码块 ─────────────────────────────────────────────────────────────────────

describe('代码块', () => {
  it('围栏代码块 → 每行 paragraph + code 标记', () => {
    const doc = parse('```\nconst x = 1;\nconst y = 2;\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      const p = b as MASTParagraphBlock;
      expect(p.type).toBe('paragraph');
      expect(p.content[0].marks?.code).toBe(true);
    }
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('const x = 1;');
    expect((blocks[1] as MASTParagraphBlock).content[0].text).toBe('const y = 2;');
  });

  it('带语言标注的代码块', () => {
    const doc = parse('```typescript\ntype Foo = string;\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as MASTParagraphBlock).content[0].marks?.code).toBe(true);
  });

  // ── codeBlockStyle: codeblock ─────────────────────────────────────────────────

  it('codeBlockStyle: codeblock → MASTCodeBlock', () => {
    const doc = parseWithOptions('```typescript\ntype Foo = string;\n```', {
      codeBlockStyle: 'codeblock',
    });
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('typescript');
    expect(cb.content).toBe('type Foo = string;');
  });

  it('codeBlockStyle: codeblock 无语言标注时 language 为空', () => {
    const doc = parseWithOptions('```\nplain code\n```', {
      codeBlockStyle: 'codeblock',
    });
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('');
    expect(cb.content).toBe('plain code');
  });

  it('codeBlockStyle: codeblock 多行代码保留完整内容', () => {
    const doc = parseWithOptions('```js\nline1\nline2\nline3\n```', {
      codeBlockStyle: 'codeblock',
    });
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.content).toBe('line1\nline2\nline3');
  });

  it('codeBlockStyle: paragraph 保持现有行为', () => {
    const doc = parseWithOptions('```js\ncode line\n```', {
      codeBlockStyle: 'paragraph',
    });
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const p = blocks[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
    expect(p.content[0].marks?.code).toBe(true);
  });

  it('codeBlockStyle: 默认为 paragraph', () => {
    const doc = parse('```js\ncode\n```');
    const blocks = topBlocks(doc);
    const p = blocks[0] as MASTParagraphBlock;
    expect(p.type).toBe('paragraph');
  });
});

// ── 图片 ───────────────────────────────────────────────────────────────────────

describe('图片', () => {
  it('独立图片 → MASTImageBlock', () => {
    const doc = parse('![alt text](https://example.com/img.png)');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const img = blocks[0] as MASTImageBlock;
    expect(img.type).toBe('image');
    expect(img.src).toBe('https://example.com/img.png');
    expect(img.alt).toBe('alt text');
    expect(img.align).toBe('center');
    expect(img.uuid).toBeUndefined();
    expect(img.isTable).toBeUndefined();
  });

  it('本地路径图片', () => {
    const doc = parse('![图片](./assets/photo.jpg)');
    const img = topBlocks(doc)[0] as MASTImageBlock;
    expect(img.src).toBe('./assets/photo.jpg');
  });
});

// ── 表格 ───────────────────────────────────────────────────────────────────────

describe('表格', () => {
  it('表格 → MASTImageBlock { isTable: true }', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const doc = parse(md);
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const img = blocks[0] as MASTImageBlock;
    expect(img.type).toBe('image');
    expect(img.isTable).toBe(true);
    expect(img.uuid).toBeUndefined();
  });

  it('表格 src 包含 Markdown 表格语法', () => {
    const md = '| 名称 | 值 |\n|---|---|\n| foo | 42 |';
    const doc = parse(md);
    const img = topBlocks(doc)[0] as MASTImageBlock;
    expect(img.src).toContain('名称');
    expect(img.src).toContain('foo');
  });
});

// ── 音频 ───────────────────────────────────────────────────────────────────────

describe('音频', () => {
  it('alt 以 "audio:" 开头 → MASTAudioBlock', () => {
    const doc = parse('![audio: 00:00 开场\n01:00 结尾](./assets/test.mp3)');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const audio = blocks[0] as MASTAudioBlock;
    expect(audio.type).toBe('audio');
    expect(audio.src).toBe('./assets/test.mp3');
    expect(audio.showNote).toBe('00:00 开场\n01:00 结尾');
    expect(audio.uuid).toBeUndefined();
  });

  it('showNote 为空字符串时也能解析', () => {
    const doc = parse('![audio:](./assets/test.mp3)');
    const audio = topBlocks(doc)[0] as MASTAudioBlock;
    expect(audio.type).toBe('audio');
    expect(audio.showNote).toBe('');
  });

  it('普通 alt 不触发音频解析', () => {
    const doc = parse('![普通图片](./assets/test.png)');
    const img = topBlocks(doc)[0] as MASTImageBlock;
    expect(img.type).toBe('image');
    expect(img.alt).toBe('普通图片');
  });
});

// ── 块 ID 唯一性 ───────────────────────────────────────────────────────────────

describe('块 ID', () => {
  it('所有块 ID 唯一', () => {
    const doc = parse('# 标题\n\n段落\n\n- 列表1\n- 列表2\n\n> 引用');
    const ids = Object.keys(doc.blocks);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('topLevel 中的 ID 都存在于 blocks', () => {
    const doc = parse('# 标题\n\n段落');
    for (const id of doc.topLevel) {
      expect(doc.blocks[id]).toBeDefined();
    }
  });
});

// ── 综合场景 ───────────────────────────────────────────────────────────────────

describe('综合场景', () => {
  it('混合内容文档', () => {
    const md = `# 标题

普通段落，包含 **粗体** 和 *斜体*。

- 列表项一
- 列表项二

> 引用文字

\`\`\`js
console.log('hello');
\`\`\`

---
`;
    const doc = parse(md);
    const blocks = topBlocks(doc);

    // H1 → bold paragraph
    expect((blocks[0] as MASTParagraphBlock).content[0].marks?.bold).toBe(true);

    // 普通段落有 3 个 run（前文、粗体、斜体部分）
    const para = blocks[1] as MASTParagraphBlock;
    expect(para.type).toBe('paragraph');

    // 列表
    expect((blocks[2] as MASTParagraphBlock).content[0].text).toBe('• ');
    expect((blocks[3] as MASTParagraphBlock).content[0].text).toBe('• ');

    // 引用
    expect(blocks[4].type).toBe('quote');

    // 代码块
    expect((blocks[5] as MASTParagraphBlock).content[0].marks?.code).toBe(true);

    // 分隔线
    const hr = blocks[blocks.length - 1] as MASTParagraphBlock;
    expect(hr.type).toBe('paragraph');
    expect(hr.content).toHaveLength(0);
  });
});

// ── 有损转换警告 ──────────────────────────────────────────────────────────────

describe('有损转换警告', () => {
  it('H1 标题产生 heading 警告', () => {
    const warnings = getWarnings('# 标题');
    expect(warnings.some((w) => w.type === 'heading' && w.message.includes('H1'))).toBe(true);
  });

  it('H2-H6 标题均产生 heading 警告', () => {
    for (let level = 2; level <= 6; level++) {
      const md = '#'.repeat(level) + ' 标题';
      const warnings = getWarnings(md);
      expect(warnings.some((w) => w.type === 'heading' && w.message.includes(`H${level}`))).toBe(true);
    }
  });

  it('多个标题产生多条 heading 警告', () => {
    const warnings = getWarnings('# H1\n## H2\n### H3');
    const headingWarnings = warnings.filter((w) => w.type === 'heading');
    expect(headingWarnings).toHaveLength(3);
  });

  it('普通段落不产生警告', () => {
    const warnings = getWarnings('普通文本，没有标题。');
    expect(warnings).toHaveLength(0);
  });

  it('bold 文本不产生 heading 警告', () => {
    const warnings = getWarnings('**加粗文本**');
    expect(warnings.filter((w) => w.type === 'heading')).toHaveLength(0);
  });
});
