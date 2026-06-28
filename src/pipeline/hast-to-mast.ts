import type { Root, Element, Text, Node } from 'hast';
import type {
  MASTDocument,
  MASTBlockNode,
  MASTBlockId,
  MASTParagraphBlock,
  MASTQuoteBlock,
  MASTImageBlock,
  MASTAudioBlock,
  MASTCodeBlock,
  MASTInlineNode,
  MASTTextRun,
  MASTInlineMarks,
} from '../mast/types.js';

// ── 转换选项与结果 ─────────────────────────────────────────────────────────────

export interface HastToMastOptions {
  /** 代码块样式：paragraph（转为段落）或 codeblock（转为代码块节点） */
  codeBlockStyle?: 'paragraph' | 'codeblock';
}

export type ConversionWarningType = 'heading' | 'task-list' | 'footnote';

export interface ConversionWarning {
  type: ConversionWarningType;
  message: string;
  source?: string;
}

export interface HastToMastResult {
  doc: MASTDocument;
  warnings: ConversionWarning[];
}

// ── ID 生成 ────────────────────────────────────────────────────────────────────

let _counter = 0;
function newId(): MASTBlockId {
  return `b_${++_counter}` as MASTBlockId;
}

/** 仅用于测试时重置计数器 */
export function _resetIdCounter() {
  _counter = 0;
}

// ── 工具函数 ───────────────────────────────────────────────────────────────────

function isElement(node: Node): node is Element {
  return node.type === 'element';
}

function isText(node: Node): node is Text {
  return node.type === 'text';
}

function getTagName(node: Node): string | null {
  return isElement(node) ? node.tagName : null;
}

// ── 行内节点提取 ───────────────────────────────────────────────────────────────

/**
 * 递归遍历 HAST 行内节点树，将嵌套标记展平为 MASTTextRun 列表。
 * 例：<strong><em>text</em></strong> → [{ text, marks: { bold, italic } }]
 */
function extractInline(nodes: Node[], marks: MASTInlineMarks = {}): MASTTextRun[] {
  const runs: MASTTextRun[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      if (node.value) {
        const run: MASTTextRun = { type: 'text', text: node.value };
        const activeMarks = { ...marks };
        if (Object.keys(activeMarks).length > 0) {
          run.marks = activeMarks;
        }
        runs.push(run);
      }
      continue;
    }

    if (!isElement(node)) continue;

    const tag = node.tagName;
    let childMarks = { ...marks };

    switch (tag) {
      case 'strong':
        childMarks.bold = true;
        break;
      case 'em':
        childMarks.italic = true;
        break;
      case 'code':
        childMarks.code = true;
        break;
      case 'del':
        childMarks.strikethrough = true;
        break;
      case 'a': {
        const href = (node.properties?.href as string) ?? '';
        // 忽略纯锚点链接（fragment links）
        if (href && !href.startsWith('#')) {
          childMarks.link = href;
        }
        break;
      }
      case 'br':
        runs.push({ type: 'text', text: '\n' });
        continue;
      // img 行内图片：作为独立 image block 处理，此处跳过
      case 'img':
        continue;
    }

    runs.push(...extractInline(node.children ?? [], childMarks));
  }

  return runs;
}

/**
 * 从段落/标题等块节点中提取行内内容，合并相邻相同标记的 run。
 */
function extractInlineContent(node: Element, extraMarks: MASTInlineMarks = {}): MASTInlineNode[] {
  const raw = extractInline(node.children ?? [], extraMarks);
  return mergeRuns(raw);
}

/** 合并相邻且标记完全相同的 TextRun */
function mergeRuns(runs: MASTTextRun[]): MASTTextRun[] {
  const result: MASTTextRun[] = [];
  for (const run of runs) {
    const prev = result[result.length - 1];
    if (prev && marksEqual(prev.marks, run.marks)) {
      prev.text += run.text;
    } else {
      result.push({ ...run });
    }
  }
  return result;
}

function marksEqual(a: MASTInlineMarks | undefined, b: MASTInlineMarks | undefined): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.code === b.code &&
    a.strikethrough === b.strikethrough &&
    a.link === b.link
  );
}

// ── 块节点转换 ─────────────────────────────────────────────────────────────────

function makeParagraph(content: MASTInlineNode[]): MASTParagraphBlock {
  return { id: newId(), type: 'paragraph', content };
}

function makeEmptyParagraph(): MASTParagraphBlock {
  return { id: newId(), type: 'paragraph', content: [] };
}

/**
 * 将 HAST 元素转换为一组 MAST 块节点。
 * 返回数组是因为某些元素（如列表）会展开为多个块。
 */
function convertBlock(
  node: Element,
  doc: MASTDocument,
  opts: HastToMastOptions = {},
  warnings: ConversionWarning[] = [],
): MASTBlockNode[] {
  const tag = node.tagName;

  // ── 标题 ──────────────────────────────────────────────────────────────────
  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1] ?? '1', 10);
    // H1–H6 全部 → bold paragraph
    const extraMarks: MASTInlineMarks = { bold: true };
    const content = extractInlineContent(node, extraMarks);
    warnings.push({ type: 'heading', message: `H${level} 标题转换为加粗段落（墨问不支持标题层级）`, source: tag });
    return [makeParagraph(content)];
  }

  // ── 段落 ──────────────────────────────────────────────────────────────────
  if (tag === 'p') {
    // 检查段落内是否只有一个 img（独立图片或音频占位）
    const imgChild = node.children.find((c) => isElement(c) && (c as Element).tagName === 'img') as Element | undefined;

    if (imgChild) {
      const src = (imgChild.properties?.src as string) ?? '';
      const alt = (imgChild.properties?.alt as string) ?? '';

      // 音频约定：alt 以 "audio:" 开头，其余部分为 show-note 文本
      if (alt.startsWith('audio:')) {
        const showNote = alt.slice('audio:'.length).trim();
        const block: MASTAudioBlock = {
          id: newId(),
          type: 'audio',
          src,
          showNote,
        };
        return [block];
      }

      const block: MASTImageBlock = {
        id: newId(),
        type: 'image',
        src,
        alt,
        align: 'center',
      };
      return [block];
    }

    const content = extractInlineContent(node);
    return [makeParagraph(content)];
  }

  // ── 引用块 ────────────────────────────────────────────────────────────────
  if (tag === 'blockquote') {
    const quoteId = newId();
    const childIds: MASTBlockId[] = [];

    for (const child of node.children) {
      if (!isElement(child)) continue;
      const childBlocks = convertBlock(child, doc, opts, warnings);
      for (const b of childBlocks) {
        doc.blocks[b.id] = b;
        childIds.push(b.id);
      }
    }

    const quoteBlock: MASTQuoteBlock = {
      id: quoteId,
      type: 'quote',
      children: childIds,
    };
    return [quoteBlock];
  }

  // ── 无序列表 ──────────────────────────────────────────────────────────────
  if (tag === 'ul') {
    return convertList(node, doc, opts, false, 0, warnings);
  }

  // ── 有序列表 ──────────────────────────────────────────────────────────────
  if (tag === 'ol') {
    return convertList(node, doc, opts, true, 0, warnings);
  }

  // ── 代码块 ────────────────────────────────────────────────────────────────
  if (tag === 'pre') {
    const codeEl = node.children.find((c) => isElement(c) && (c as Element).tagName === 'code') as Element | undefined;

    const rawText = codeEl ? extractTextContent(codeEl) : extractTextContent(node);

    // 提取语言标识（从 code 元素的 className）
    let language = '';
    if (codeEl && codeEl.properties?.className) {
      const classNames = Array.isArray(codeEl.properties.className)
        ? (codeEl.properties.className as string[])
        : [codeEl.properties.className as string];
      // 常见格式：language-js, lang-js, js 等
      const langClass = classNames.find(
        (c) => typeof c === 'string' && (c.startsWith('language-') || c.startsWith('lang-')),
      );
      if (langClass) {
        language = langClass.replace(/^language-|^lang-/, '');
      } else if (classNames.length > 0 && typeof classNames[0] === 'string') {
        // 直接使用第一个 class 名作为语言（如 typescript, python）
        language = classNames[0];
      }
    }

    // codeBlockStyle: codeblock → 生成 MASTCodeBlock
    if (opts.codeBlockStyle === 'codeblock') {
      const block: MASTCodeBlock = {
        id: newId(),
        type: 'codeblock',
        language,
        content: rawText.replace(/\n$/, ''),
      };
      return [block];
    }

    // 默认 paragraph 模式：每行转为带 code 标记的 paragraph
    const lines = rawText.replace(/\n$/, '').split('\n');
    return lines.map((line) => makeParagraph([{ type: 'text', text: line, marks: { code: true } }]));
  }

  // ── 表格 ──────────────────────────────────────────────────────────────────
  if (tag === 'table') {
    // 序列化回 Markdown 表格语法，供后续渲染阶段使用
    const tableMarkdown = tableToMarkdown(node);
    const block: MASTImageBlock = {
      id: newId(),
      type: 'image',
      src: tableMarkdown,
      alt: 'table',
      align: 'center',
      isTable: true,
    };
    return [block];
  }

  // ── 分隔线 ────────────────────────────────────────────────────────────────
  if (tag === 'hr') {
    return [makeEmptyParagraph()];
  }

  // ── div / section 等容器：递归处理子节点 ──────────────────────────────────
  if (['div', 'section', 'article', 'main'].includes(tag)) {
    const blocks: MASTBlockNode[] = [];
    for (const child of node.children) {
      if (isElement(child)) {
        blocks.push(...convertBlock(child, doc, opts, warnings));
      }
    }
    return blocks;
  }

  // ── 脚注检测 ────────────────────────────────────────────────────────────
  if (tag === 'sup' && node.properties?.id && String(node.properties.id).startsWith('fnref-')) {
    warnings.push({ type: 'footnote', message: '脚注引用转换为纯文本（墨问不支持脚注）', source: 'footnote-ref' });
    const content = extractInlineContent(node);
    return content.length > 0 ? [makeParagraph(content)] : [];
  }

  if (tag === 'section' && node.properties?.['data-footnotes'] !== undefined) {
    warnings.push({ type: 'footnote', message: '脚注定义被丢弃（墨问不支持脚注）', source: 'footnote-def' });
    return [];
  }

  // 其他未知标签：尝试提取文本
  const content = extractInlineContent(node);
  if (content.length > 0) {
    return [makeParagraph(content)];
  }
  return [];
}

// ── 列表转换 ───────────────────────────────────────────────────────────────────

function convertList(
  listEl: Element,
  doc: MASTDocument,
  opts: HastToMastOptions,
  ordered: boolean,
  depth: number,
  warnings: ConversionWarning[] = [],
): MASTBlockNode[] {
  const blocks: MASTBlockNode[] = [];
  let itemIndex = 1;
  const indent = '  '.repeat(depth);

  for (const child of listEl.children) {
    if (!isElement(child) || child.tagName !== 'li') continue;

    // 检测 task list（li 内含 <input type="checkbox">）
    const hasCheckbox = child.children.some(
      (c) => isElement(c) && (c as Element).tagName === 'input' && (c as Element).properties?.type === 'checkbox',
    );
    if (hasCheckbox) {
      warnings.push({
        type: 'task-list',
        message: '任务列表项转换为纯文本（墨问不支持 checkbox）',
        source: 'task-list',
      });
    }

    const prefix = ordered ? `${indent}${itemIndex}. ` : `${indent}• `;
    itemIndex++;

    // li 内容可能包含段落和嵌套列表
    const paragraphContent: MASTInlineNode[] = [];
    const nestedBlocks: MASTBlockNode[] = [];

    for (const liChild of child.children) {
      if (!isElement(liChild)) {
        if (isText(liChild) && liChild.value.trim()) {
          paragraphContent.push({ type: 'text', text: liChild.value });
        }
        continue;
      }

      if (liChild.tagName === 'ul') {
        nestedBlocks.push(...convertList(liChild, doc, opts, false, depth + 1, warnings));
      } else if (liChild.tagName === 'ol') {
        nestedBlocks.push(...convertList(liChild, doc, opts, true, depth + 1, warnings));
      } else if (liChild.tagName === 'p') {
        paragraphContent.push(...extractInlineContent(liChild));
      } else {
        paragraphContent.push(...extractInlineContent(liChild));
      }
    }

    // 构建带前缀的段落
    const prefixRun: MASTTextRun = { type: 'text', text: prefix };
    const content: MASTInlineNode[] = paragraphContent.length > 0 ? [prefixRun, ...paragraphContent] : [prefixRun];

    blocks.push(makeParagraph(content));
    blocks.push(...nestedBlocks);
  }

  return blocks;
}

// ── 表格序列化 ─────────────────────────────────────────────────────────────────

function extractTextContent(node: Element | Text): string {
  if (isText(node)) return node.value;
  let text = '';
  for (const child of (node as Element).children ?? []) {
    if (isText(child)) text += child.value;
    else if (isElement(child)) text += extractTextContent(child);
  }
  return text;
}

function tableToMarkdown(tableEl: Element): string {
  const rows: string[][] = [];

  function collectRows(el: Element) {
    for (const child of el.children) {
      if (!isElement(child)) continue;
      if (child.tagName === 'tr') {
        const cells = child.children
          .filter((c) => isElement(c) && ['td', 'th'].includes((c as Element).tagName))
          .map((c) => extractTextContent(c as Element).trim());
        rows.push(cells);
      } else {
        collectRows(child);
      }
    }
  }

  collectRows(tableEl);
  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => {
    while (r.length < colCount) r.push('');
    return r;
  });

  const header = `| ${(padded[0] ?? []).join(' | ')} |`;
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = padded.slice(1).map((r) => `| ${r.join(' | ')} |`);

  return [header, separator, ...body].join('\n');
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 将 HAST Root 转换为 MASTDocument。
 *
 * @param hast HAST Root 节点
 * @param opts 转换选项
 * @returns 包含文档和转换警告的结果对象
 */
export function hastToMast(hast: Root, opts: HastToMastOptions = {}): HastToMastResult {
  const doc: MASTDocument = { blocks: {}, topLevel: [] };
  const warnings: ConversionWarning[] = [];

  for (const node of hast.children) {
    if (!isElement(node)) continue;
    const blocks = convertBlock(node, doc, opts, warnings);
    for (const block of blocks) {
      doc.blocks[block.id] = block;
      doc.topLevel.push(block.id);
    }
  }

  return { doc, warnings };
}
