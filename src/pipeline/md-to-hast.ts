import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import type { Root, Element, Node } from 'hast';
import { preprocessHighlight } from './remark-highlight.js';

/**
 * 将 Markdown 字符串解析为 HAST（Hypertext AST）。
 * 使用 unified + remark-parse + remark-gfm + remark-rehype。
 */
export function mdToHast(markdown: string): Root {
  // 预处理：==text== → <mark>text</mark>
  let preprocessed = preprocessHighlight(markdown);
  // 预处理：![[note:noteId]] → ![note:noteId](note:noteId)
  preprocessed = preprocessed.replace(/!\[\[note:([^\]]+)\]\]/g, '![note:$1](note:$1)');
  // 预处理：![[pdf:path]] → ![pdf:path](pdf:path)
  preprocessed = preprocessed.replace(/!\[\[pdf:([^\]]+)\]\]/g, '![pdf:$1](pdf:$1)');

  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true });

  const mdast = processor.parse(preprocessed);
  const hast = processor.runSync(mdast) as Root;

  // 后处理：将 raw <mark> 节点转为 HAST element 节点
  convertRawMarkToElements(hast);

  return hast;
}

/** 将 HAST 中的 raw <mark>/<mark> 节点转为 element 节点 */
function convertRawMarkToElements(node: Node): void {
  if (node.type !== 'element' && node.type !== 'root') return;
  const parent = node as unknown as { children: Node[] };

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (!child) continue;

    // 递归处理子节点
    if (child.type === 'element' || child.type === 'root') {
      convertRawMarkToElements(child);
      continue;
    }

    // 处理 raw 节点：寻找 <mark>...</mark> 配对
    const childValue = child.type === 'raw' ? (child as unknown as { value: string }).value : null;
    if (childValue === '<mark>') {
      // 收集 <mark> 和 </mark> 之间的所有节点
      const innerNodes: Element['children'] = [];
      let j = i + 1;
      while (j < parent.children.length) {
        const next = parent.children[j];
        if (!next) {
          j++;
          continue;
        }
        const nextValue = next.type === 'raw' ? (next as unknown as { value: string }).value : null;
        if (nextValue === '</mark>') break;
        if (next.type === 'element' || next.type === 'text') {
          innerNodes.push(next as unknown as Element['children'][number]);
        }
        j++;
      }

      if (j < parent.children.length) {
        // 找到了配对的 </mark>，替换为 element 节点
        const markElement: Element = {
          type: 'element',
          tagName: 'mark',
          properties: {},
          children: innerNodes,
        };
        parent.children.splice(i, j - i + 1, markElement as unknown as Node);
      }
    }
  }
}
