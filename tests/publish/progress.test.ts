import { describe, it, expect } from 'vitest';
import { buildProgressBar, formatEta, createProgressLine } from '../../src/publish/progress.js';

// ── buildProgressBar ────────────────────────────────────────────────────────

describe('buildProgressBar', () => {
  it('0% 时全为空', () => {
    expect(buildProgressBar(0, 10)).toBe('░░░░░░░░░░');
  });

  it('100% 时全为实心', () => {
    expect(buildProgressBar(10, 10)).toBe('██████████');
  });

  it('50% 时一半填充', () => {
    const bar = buildProgressBar(5, 10);
    const filled = (bar.match(/█/g) || []).length;
    const empty = (bar.match(/░/g) || []).length;
    expect(filled).toBe(5);
    expect(empty).toBe(5);
  });

  it('自定义宽度', () => {
    expect(buildProgressBar(0, 5, 4)).toBe('░░░░');
    expect(buildProgressBar(5, 5, 4)).toBe('████');
  });
});

// ── formatEta ───────────────────────────────────────────────────────────────

describe('formatEta', () => {
  it('小于 60 秒显示秒', () => {
    expect(formatEta(30)).toBe('30s');
  });

  it('60 秒显示 1m0s', () => {
    expect(formatEta(60)).toBe('1m0s');
  });

  it('2 分 30 秒显示 2m30s', () => {
    expect(formatEta(150)).toBe('2m30s');
  });

  it('0 秒显示 0s', () => {
    expect(formatEta(0)).toBe('0s');
  });
});

// ── createProgressLine ──────────────────────────────────────────────────────

describe('createProgressLine', () => {
  it('包含进度条、数量、百分比和 ETA', () => {
    const line = createProgressLine(3, 10, 300);
    expect(line).toContain('3/10');
    expect(line).toContain('30%');
    expect(line).toContain('ETA:');
    expect(line).toContain('█');
    expect(line).toContain('░');
  });

  it('第一个文件时 ETA 显示计算中', () => {
    const line = createProgressLine(1, 10, 0);
    expect(line).toContain('ETA: 计算中');
  });

  it('完成时不显示 ETA', () => {
    const line = createProgressLine(10, 10, 500);
    expect(line).not.toContain('ETA');
    expect(line).toContain('完成');
  });
});
