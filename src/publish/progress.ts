const BAR_WIDTH = 10;

/** 构建进度条字符串，如 "██████░░░░" */
export function buildProgressBar(current: number, total: number, width: number = BAR_WIDTH): string {
  const ratio = total > 0 ? current / total : 0;
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** 格式化 ETA 秒数为人类可读格式，如 "2m30s" */
export function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s}s`;
}

/**
 * 生成单行进度文本，如：
 * "[██████░░░░] 15/50 (30%) ETA: 2m30s"
 *
 * @param elapsedMs 已耗毫秒数（从第一个文件开始计时）
 */
export function createProgressLine(current: number, total: number, elapsedMs: number): string {
  const bar = buildProgressBar(current, total);
  const pct = Math.round((current / total) * 100);

  if (current >= total) {
    const elapsedSec = Math.round(elapsedMs / 1000);
    return `[${bar}] ${current}/${total} (${pct}%) 完成，耗时 ${formatEta(elapsedSec)}`;
  }

  if (current <= 1) {
    return `[${bar}] ${current}/${total} (${pct}%) ETA: 计算中`;
  }

  // 根据已耗时间推算剩余
  const avgPerFile = elapsedMs / current;
  const remaining = avgPerFile * (total - current);
  const etaSec = Math.round(remaining / 1000);

  return `[${bar}] ${current}/${total} (${pct}%) ETA: ${formatEta(etaSec)}`;
}
