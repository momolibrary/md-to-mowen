import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 字体加载 ──────────────────────────────────────────────────────────────────

let _fontCache: { regular: Buffer; bold: Buffer } | null = null;

async function loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (_fontCache) return _fontCache;

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
    const systemFont = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
    try {
      const data = await readFile(systemFont);
      _fontCache = { regular: data, bold: data };
      return _fontCache;
    } catch {
      throw new Error(
        '找不到中文字体。请将 NotoSansSC-Regular.woff 和 NotoSansSC-Bold.woff 放到 src/publish/fonts/ 目录。'
      );
    }
  }
}

// ── 常量 ──────────────────────────────────────────────────────────────────────

const TABLE_WIDTH = 1000;
const OUTER_PADDING = 20;
const BORDER_WIDTH = 1;
const BORDER_RADIUS = 8;

const FONT_SIZE = 14;
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.4); // 20px
const HEADER_PADDING_V = 12;
const HEADER_PADDING_H = 16;
const CELL_PADDING_V = 10;
const CELL_PADDING_H = 16;

const COLORS = {
  headerBg: '#F4F1EA',
  headerText: '#1F1F1F',
  oddRowBg: '#FFFFFF',
  evenRowBg: '#FBF6ED',
  cellTextPrimary: '#1F1F1F',
  cellTextSecondary: '#6F6A63',
  border: '#E6E1D8',
  borderStrong: '#D8D1C6',
  brand: '#8A6A3F',
};

// ── SVG 尺寸解析 ──────────────────────────────────────────────────────────────

function parseSvgSize(svg: string): { width: number; height: number } {
  const w = Number(svg.match(/width="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
  const h = Number(svg.match(/height="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
  return { width: Math.ceil(w), height: Math.ceil(h) };
}

// ── 表格渲染 ──────────────────────────────────────────────────────────────────

export async function renderTableToPng(tableMarkdown: string): Promise<Buffer> {
  const { headers, rows } = parseMarkdownTable(tableMarkdown);
  const fonts = await loadFonts();

  const vnode = buildTableVnode(headers, rows);

  // 只传 width，不传 height，让 Satori 按内容自动计算真实高度
  const svg = await satori(vnode, {
    width: TABLE_WIDTH + OUTER_PADDING * 2,
    fonts: [
      { name: 'Noto Sans SC', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans SC', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ── VNode 构建 ────────────────────────────────────────────────────────────────

function buildTableVnode(headers: string[], rows: string[][]): Record<string, unknown> {
  const colCount = headers.length || 1;

  // 表头单元格
  const headerCells = headers.map((h) => ({
    type: 'div',
    props: {
      children: escapeHtml(h),
      style: {
        flex: 1,
        paddingTop: HEADER_PADDING_V,
        paddingBottom: HEADER_PADDING_V,
        paddingLeft: HEADER_PADDING_H,
        paddingRight: HEADER_PADDING_H,
        fontSize: FONT_SIZE,
        lineHeight: `${LINE_HEIGHT}px`,
        fontWeight: 600,
        color: COLORS.headerText,
        fontFamily: 'Noto Sans SC',
        borderBottom: `${BORDER_WIDTH}px solid ${COLORS.borderStrong}`,
      },
    },
  }));

  // 数据行
  const dataRows = rows.map((row, rowIndex) => {
    const isOdd = rowIndex % 2 === 0;
    const bgColor = isOdd ? COLORS.oddRowBg : COLORS.evenRowBg;
    const isLast = rowIndex === rows.length - 1;

    const cells = Array.from({ length: colCount }, (_, colIndex) => {
      const cellText = colIndex < row.length ? row[colIndex] : '';
      return {
        type: 'div',
        props: {
          children: escapeHtml(cellText),
          style: {
            flex: 1,
            paddingTop: CELL_PADDING_V,
            paddingBottom: CELL_PADDING_V,
            paddingLeft: CELL_PADDING_H,
            paddingRight: CELL_PADDING_H,
            fontSize: FONT_SIZE,
            lineHeight: `${LINE_HEIGHT}px`,
            color: COLORS.cellTextPrimary,
            fontFamily: 'Noto Sans SC',
            borderBottom: isLast ? 'none' : `${BORDER_WIDTH}px solid ${COLORS.border}`,
          },
        },
      };
    });

    return {
      type: 'div',
      props: {
        children: cells,
        style: {
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: bgColor,
          borderRadius: isLast ? `0 0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px` : 0,
        },
      },
    };
  });

  // 表格容器
  const tableContainer = {
    type: 'div',
    props: {
      children: [
        {
          type: 'div',
          props: {
            children: headerCells,
            style: {
              display: 'flex',
              flexDirection: 'row',
              backgroundColor: COLORS.headerBg,
              borderRadius: `${BORDER_RADIUS}px ${BORDER_RADIUS}px 0 0`,
            },
          },
        },
        ...dataRows,
      ],
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: TABLE_WIDTH,
        borderRadius: BORDER_RADIUS,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        fontFamily: 'Noto Sans SC',
        border: `${BORDER_WIDTH}px solid ${COLORS.border}`,
      },
    },
  };

  // 外层容器：boxSizing: border-box 确保 padding 计入尺寸
  return {
    type: 'div',
    props: {
      children: [tableContainer],
      style: {
        display: 'flex',
        flexDirection: 'column',
        padding: OUTER_PADDING,
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
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
