/**
 * remark 插件：解析 ==高亮文本== 语法。
 *
 * 策略：在 Markdown 预处理阶段将 ==text== 替换为 <mark>text</mark>，
 * 经 remark-rehype（allowDangerousHtml）后保留为 HAST 元素，
 * 最终在 hast-to-mast 阶段的 extractInline 中转为 highlight 标记。
 */

/** 预处理：将 ==text== 替换为 <mark>text</mark> */
export function preprocessHighlight(markdown: string): string {
  // 匹配 ==...==，不跨行，非贪婪匹配
  return markdown.replace(/==([^=\n]+?)==/g, (_match, inner: string) => {
    return `<mark>${inner}</mark>`;
  });
}
