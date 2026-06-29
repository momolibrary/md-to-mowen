import { describe, it, expect } from 'vitest';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';

// 使用系统 Arial Unicode 字体（支持中文）
async function loadFont(): Promise<Buffer> {
  return readFile('/System/Library/Fonts/Supplemental/Arial Unicode.ttf');
}

describe('Satori + resvg-js 基础验证', () => {
  it('能生成 SVG', async () => {
    const fontData = await loadFont();
    const svg = await satori(
      {
        type: 'div',
        props: {
          children: 'Hello World',
          style: { fontSize: 24, color: 'black' },
        },
      },
      {
        width: 200,
        height: 50,
        fonts: [
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 400,
            style: 'normal',
          },
        ],
      }
    );

    expect(svg).toContain('<svg');
    // Satori 将文本渲染为 path 元素，不是 text 元素
    expect(svg).toContain('<path');
  });

  it('能生成中文 SVG', async () => {
    const fontData = await loadFont();
    const svg = await satori(
      {
        type: 'div',
        props: {
          children: '你好世界',
          style: { fontSize: 24, color: 'black' },
        },
      },
      {
        width: 200,
        height: 50,
        fonts: [
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 400,
            style: 'normal',
          },
        ],
      }
    );

    expect(svg).toContain('<svg');
    // 中文字符被渲染为 path 元素
    expect(svg).toContain('<path');
  });

  it('能生成 PNG', async () => {
    const svg = `<svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="50" fill="blue"/>
      <text x="10" y="30" fill="white" font-size="20">Test</text>
    </svg>`;

    const resvg = new Resvg(svg);
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(0);
    // PNG 魔数检查
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // P
    expect(pngBuffer[2]).toBe(0x4e); // N
    expect(pngBuffer[3]).toBe(0x47); // G
  });

  it('SVG → PNG 完整流水线', async () => {
    const fontData = await loadFont();
    const svg = await satori(
      {
        type: 'div',
        props: {
          children: [
            {
              type: 'div',
              props: {
                children: '表格标题',
                style: {
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'white',
                  backgroundColor: '#1e3a5f',
                  padding: '12px 16px',
                },
              },
            },
            {
              type: 'div',
              props: {
                children: '表格内容',
                style: {
                  fontSize: 14,
                  color: '#2c3e50',
                  padding: '10px 16px',
                  backgroundColor: '#fafbfc',
                },
              },
            },
          ],
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: 400,
            border: '1px solid #e8ecf0',
            borderRadius: 8,
            overflow: 'hidden',
          },
        },
      },
      {
        width: 400,
        height: 200,
        fonts: [
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 700,
            style: 'normal',
          },
        ],
      }
    );

    expect(svg).toContain('<svg');

    // 转换为 PNG
    const resvg = new Resvg(svg);
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(100);
  });
});
