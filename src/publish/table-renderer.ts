import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 字体加载 ──────────────────────────────────────────────────────────────────

let _fontCache: { regular: Buffer; bold: Buffer } | null = null;

/** 加载字体（首次加载后缓存） */
async function loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (_fontCache) return _fontCache;

  // 尝试加载 bundled 字体
  const bundledDir = join(__dirname, 'fonts');
  const regularPath = join(bundledDir, 'NotoSansSC-Regular.woff');
  const boldPath = join(bundledDir, 'NotoSansSC-Bold.woff');

  try {
    _fontCache = {
      regular: await readFile(regularPath),
      bold: await readFile(boldPath),
    };
    return _fontCache;
  } catch {
    // fallback: 使用系统 Arial Unicode（macOS）
    const systemFont = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
    try {
      const data = await readFile(systemFont);
      _fontCache = { regular: data, bold: data };
      return _fontCache;
    } catch {
      throw new Error(
        '找不到中文字体。请将 NotoSansSC-Regular.ttf 和 NotoSansSC-Bold.ttf 放到 src/publish/fonts/ 目录。'
      );
    }
  }
}

// ── 表格渲染 ──────────────────────────────────────────────────────────────────

/**
 * 将 Markdown 表格语法渲染为 PNG Buffer。
 * 使用 Satori（HTML→SVG）+ resvg-js（SVG→PNG）替代 Playwright。
 */
export async function renderTableToPng(tableMarkdown: string): Promise<Buffer> {
  const { headers, rows } = parseMarkdownTable(tableMarkdown);
  const fonts = await loadFonts();

  // 构建 Satori vnode（flexbox 布局模拟表格）
  const vnode = buildTableVnode(headers, rows);

  // Step 1: HTML/JSX → SVG
  const svg = await satori(vnode, {
    width: TABLE_WIDTH,
    height: estimateHeight(headers, rows),
    fonts: [
      { name: 'Noto Sans SC', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans SC', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });

  // Step 2: SVG → PNG
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ── 常量 ──────────────────────────────────────────────────────────────────────

const TABLE_WIDTH = 1000;
const FONT_SIZE = 14;
const HEADER_PADDING_V = 12;
const HEADER_PADDING_H = 16;
const CELL_PADDING_V = 10;
const CELL_PADDING_H = 16;

const COLORS = {
  headerGradientStart: '#1e3a5f',
  headerGradientEnd: '#2d4a6f',
  headerText: '#ffffff',
  oddRowBg: '#fafbfc',
  evenRowBg: '#ffffff',
  cellText: '#2c3e50',
  border: '#e8ecf0',
};

// ── VNode 构建 ────────────────────────────────────────────────────────────────

/** 估算表格高度（用于 SVG viewport） */
function estimateHeight(headers: string[], rows: string[][]): number {
  const headerHeight = FONT_SIZE + HEADER_PADDING_V * 2;
  const rowHeight = FONT_SIZE + CELL_PADDING_V * 2;
  const borderHeight = rows.length; // 每行 1px border
  return headerHeight + rows.length * rowHeight + borderHeight + 20; // 20px margin
}

/** 构建 Satori 兼容的 vnode 树（flexbox 布局模拟表格） */
function buildTableVnode(headers: string[], rows: string[][]): Record<string, unknown> {
  const colCount = headers.length || 1;
  const colFlex = 1;

  // 表头行
  const headerCells = headers.map((h) => ({
    type: 'div',
    props: {
      children: escapeHtml(h),
      style: {
        flex: colFlex,
        padding: `${HEADER_PADDING_V}px ${HEADER_PADDING_H}px`,
        fontSize: FONT_SIZE,
        fontWeight: 700,
        color: COLORS.headerText,
        fontFamily: 'Noto Sans SC',
      },
    },
  }));

  // 数据行
  const dataRows = rows.map((row, rowIndex) => {
    const isOdd = rowIndex % 2 === 0;
    const bgColor = isOdd ? COLORS.oddRowBg : COLORS.evenRowBg;

    const cells = row.map((cell) => ({
      type: 'div',
      props: {
        children: escapeHtml(cell),
        style: {
          flex: colFlex,
          padding: `${CELL_PADDING_V}px ${CELL_PADDING_H}px`,
          fontSize: FONT_SIZE,
          color: COLORS.cellText,
          fontFamily: 'Noto Sans SC',
          borderBottom: `1px solid ${COLORS.border}`,
        },
      },
    }));

    // 补齐不足的列
    while (cells.length < colCount) {
      cells.push({
        type: 'div',
        props: {
          children: '',
          style: {
            flex: colFlex,
            padding: `${CELL_PADDING_V}px ${CELL_PADDING_H}px`,
            fontSize: FONT_SIZE,
            color: COLORS.cellText,
            fontFamily: 'Noto Sans SC',
            borderBottom: `1px solid ${COLORS.border}`,
          },
        },
      });
    }

    return {
      type: 'div',
      props: {
        children: cells,
        style: {
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: bgColor,
        },
      },
    };
  });

  // 整体容器
  return {
    type: 'div',
    props: {
      children: [
        // 表头
        {
          type: 'div',
          props: {
            children: headerCells,
            style: {
              display: 'flex',
              flexDirection: 'row',
              backgroundImage: `linear-gradient(135deg, ${COLORS.headerGradientStart}, ${COLORS.headerGradientEnd})`,
            },
          },
        },
        // 数据行
        ...dataRows,
      ],
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: TABLE_WIDTH,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        margin: 20,
        fontFamily: 'Noto Sans SC',
      },
    },
  };
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const headers = parseRow(lines[0] ?? '');
  // lines[1] is the separator row (---|---)
  const rows = lines.slice(2).map(parseRow);

  return { headers, rows };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
