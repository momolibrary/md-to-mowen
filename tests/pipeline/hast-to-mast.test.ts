import { describe, it, expect, beforeEach } from 'vitest';
import { mdToHast } from '../../src/pipeline/md-to-hast.js';
import {
  hastToMast,
  _resetIdCounter,
  type ConversionWarning,
} from '../../src/pipeline/hast-to-mast.js';
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

  it('粗体包裹行内 code → 仅保留 code（不叠加 bold）', () => {
    const doc = parse('**`bold code`**');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(1);
    expect(p.content[0].text).toBe('bold code');
    expect(p.content[0].marks).toEqual({ code: true });
  });

  it('粗体段落内嵌 code → code 段无 bold', () => {
    const doc = parse('**bold `code` text**');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(3);
    expect(p.content[0].marks).toEqual({ bold: true });
    expect(p.content[1].text).toBe('code');
    expect(p.content[1].marks).toEqual({ code: true });
    expect(p.content[2].marks).toEqual({ bold: true });
  });

  it('标题内行内 code → code 段无 bold', () => {
    const doc = parse('# Title with `code`');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(2);
    expect(p.content[0].marks?.bold).toBe(true);
    expect(p.content[1].text).toBe('code');
    expect(p.content[1].marks).toEqual({ code: true });
    expect(p.content[1].marks?.bold).toBeUndefined();
  });

  it('删除线/链接包裹 code → 仅保留 code', () => {
    const strikeDoc = parse('~~`strike code`~~');
    const strikeP = topBlocks(strikeDoc)[0] as MASTParagraphBlock;
    expect(strikeP.content[0].marks).toEqual({ code: true });

    const linkDoc = parse('[`link code`](https://x.com)');
    const linkP = topBlocks(linkDoc)[0] as MASTParagraphBlock;
    expect(linkP.content[0].marks).toEqual({ code: true });
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

  it('多段落各自独立（空行生成空段落）', () => {
    const doc = parse('第一段\n\n第二段');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(3);
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('第一段');
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0); // 空行 → 空段落
    expect((blocks[2] as MASTParagraphBlock).content[0].text).toBe('第二段');
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
  it('围栏代码块 → MASTCodeBlock', () => {
    const doc = parse('```\nconst x = 1;\nconst y = 2;\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('');
    expect(cb.content).toBe('const x = 1;\nconst y = 2;');
  });

  it('带语言标注的代码块 → MASTCodeBlock 带 language', () => {
    const doc = parse('```typescript\ntype Foo = string;\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('typescript');
    expect(cb.content).toBe('type Foo = string;');
  });

  it('多行代码保留完整内容', () => {
    const doc = parse('```js\nline1\nline2\nline3\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.content).toBe('line1\nline2\nline3');
  });

  it('无语言标注时 language 为空', () => {
    const doc = parse('```\nplain code\n```');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(1);
    const cb = blocks[0] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('');
    expect(cb.content).toBe('plain code');
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
  it('混合内容文档（空行生成空段落）', () => {
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

    // 空行 → 空段落
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0);

    // 普通段落
    const para = blocks[2] as MASTParagraphBlock;
    expect(para.type).toBe('paragraph');

    // 空行 → 空段落
    expect((blocks[3] as MASTParagraphBlock).content).toHaveLength(0);

    // 列表
    expect((blocks[4] as MASTParagraphBlock).content[0].text).toBe('• ');
    expect((blocks[5] as MASTParagraphBlock).content[0].text).toBe('• ');

    // 空行 → 空段落
    expect((blocks[6] as MASTParagraphBlock).content).toHaveLength(0);

    // 引用
    expect(blocks[7].type).toBe('quote');

    // 空行 → 空段落
    expect((blocks[8] as MASTParagraphBlock).content).toHaveLength(0);

    // 代码块 → MASTCodeBlock
    const cb = blocks[9] as MASTCodeBlock;
    expect(cb.type).toBe('codeblock');
    expect(cb.language).toBe('js');
    expect(cb.content).toContain('console.log');

    // 空行 → 空段落
    expect((blocks[10] as MASTParagraphBlock).content).toHaveLength(0);

    // 分隔线
    const hr = blocks[blocks.length - 1] as MASTParagraphBlock;
    expect(hr.type).toBe('paragraph');
    expect(hr.content).toHaveLength(0);
  });
});

// ── 空行处理 ─────────────────────────────────────────────────────────────────

describe('空行处理', () => {
  it('单空行 → 1 个空段落', () => {
    const doc = parse('第一行\n\n第二行');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(3);
    expect((blocks[0] as MASTParagraphBlock).content[0].text).toBe('第一行');
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0);
    expect((blocks[2] as MASTParagraphBlock).content[0].text).toBe('第二行');
  });

  it('双空行 → 2 个空段落', () => {
    const doc = parse('第一行\n\n\n第二行');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(4);
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0);
    expect((blocks[2] as MASTParagraphBlock).content).toHaveLength(0);
  });

  it('标题后空行 → 正确插入', () => {
    const doc = parse('# 标题\n\n正文');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(3);
    expect((blocks[0] as MASTParagraphBlock).content[0].marks?.bold).toBe(true);
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0);
    expect((blocks[2] as MASTParagraphBlock).content[0].text).toBe('正文');
  });

  it('连续三空行 → 3 个空段落', () => {
    const doc = parse('A\n\n\n\nB');
    const blocks = topBlocks(doc);
    expect(blocks).toHaveLength(5);
    expect((blocks[1] as MASTParagraphBlock).content).toHaveLength(0);
    expect((blocks[2] as MASTParagraphBlock).content).toHaveLength(0);
    expect((blocks[3] as MASTParagraphBlock).content).toHaveLength(0);
  });
});

// ── 高亮支持 ─────────────────────────────────────────────────────────────────

describe('高亮支持', () => {
  it('==text== → highlight TextRun', () => {
    const doc = parse('普通 ==高亮== 文字');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(3);
    expect(p.content[0].text).toBe('普通 ');
    expect(p.content[0].marks).toBeUndefined();
    expect(p.content[1].text).toBe('高亮');
    expect(p.content[1].marks?.highlight).toBe(true);
    expect(p.content[2].text).toBe(' 文字');
    expect(p.content[2].marks).toBeUndefined();
  });

  it('==**粗体**== → bold + highlight', () => {
    const doc = parse('==**粗体高亮**==');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(1);
    expect(p.content[0].marks?.bold).toBe(true);
    expect(p.content[0].marks?.highlight).toBe(true);
  });

  it('连续 ==a== ==b== → 两个独立高亮', () => {
    const doc = parse('==甲== ==乙==');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content[0].text).toBe('甲');
    expect(p.content[0].marks?.highlight).toBe(true);
    expect(p.content[1].text).toBe(' ');
    expect(p.content[1].marks).toBeUndefined();
    expect(p.content[2].text).toBe('乙');
    expect(p.content[2].marks?.highlight).toBe(true);
  });

  it('普通文本不受影响', () => {
    const doc = parse('没有高亮的文字');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    expect(p.content).toHaveLength(1);
    expect(p.content[0].marks).toBeUndefined();
  });

  it('未闭合的 == 不触发高亮', () => {
    const doc = parse('这是 ==未闭合的文字');
    const p = topBlocks(doc)[0] as MASTParagraphBlock;
    // 不应有 highlight mark
    for (const run of p.content) {
      expect(run.marks?.highlight).toBeUndefined();
    }
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
      expect(warnings.some((w) => w.type === 'heading' && w.message.includes(`H${level}`))).toBe(
        true
      );
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
