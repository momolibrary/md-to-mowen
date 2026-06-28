import type {
  MASTDocument,
  MASTBlockNode,
  MASTParagraphBlock,
  MASTQuoteBlock,
  MASTImageBlock,
  MASTAudioBlock,
  MASTCodeBlock,
  MASTNoteBlock,
  MASTTextRun,
  MASTInlineMarks,
} from './types.js';

/**
 * 将 MASTDocument 序列化为 Markdown 文本。
 */
export function mastToMarkdown(doc: MASTDocument): string {
  const parts: string[] = [];
  let prevType: string | undefined;

  for (const id of doc.topLevel) {
    const block = doc.blocks[id];
    if (!block) continue;

    // 空行分隔：连续空 paragraph 合并为一个空行
    if (block.type === 'paragraph' && (block as MASTParagraphBlock).content.length === 0) {
      if (prevType === 'empty') continue;
      parts.push('');
      prevType = 'empty';
      continue;
    }

    // 块之间加空行（段落、引用块之间）
    if (prevType && prevType !== 'empty') {
      parts.push('');
    }

    prevType = block.type;
    parts.push(serializeBlock(block, doc));
  }

  return parts.join('\n');
}

function serializeBlock(block: MASTBlockNode, doc: MASTDocument): string {
  switch (block.type) {
    case 'paragraph':
      return serializeParagraph(block);
    case 'quote':
      return serializeQuote(block, doc);
    case 'image':
      return serializeImage(block);
    case 'audio':
      return serializeAudio(block);
    case 'codeblock':
      return serializeCodeBlock(block);
    case 'note':
      return serializeNote(block);
  }
}

function serializeParagraph(block: MASTParagraphBlock): string {
  if (block.content.length === 0) return '';
  return block.content.map(serializeTextRun).join('');
}

function serializeQuote(block: MASTQuoteBlock, doc: MASTDocument): string {
  const lines: string[] = [];
  for (const childId of block.children) {
    const child = doc.blocks[childId];
    if (child && child.type === 'paragraph') {
      const text = serializeParagraph(child as MASTParagraphBlock);
      // 段落内嵌换行，每行都要加 `> ` 前缀
      for (const line of text.split('\n')) {
        lines.push(`> ${line}`);
      }
    }
  }
  return lines.join('\n');
}

function serializeImage(block: MASTImageBlock): string {
  const src = block.uuid ? block.src : block.src;
  return `![${block.alt}](${src})`;
}

function serializeAudio(block: MASTAudioBlock): string {
  const src = block.uuid ? block.src : block.src;
  return `![audio: ${block.showNote}](${src})`;
}

function serializeCodeBlock(block: MASTCodeBlock): string {
  const lang = block.language || '';
  return '```' + lang + '\n' + block.content + '\n```';
}

function serializeNote(block: MASTNoteBlock): string {
  return `![[note:${block.noteId}]]`;
}

function serializeTextRun(run: MASTTextRun): string {
  if (!run.marks) return run.text;

  let text = run.text;

  // code 最先包裹（innermost），遇到 code 时只保留 code
  if (run.marks.code) {
    text = `\`${text}\``;
    // code 不与其他标记叠加
    if (run.marks.link) text = `[${text}](${run.marks.link})`;
    return text;
  }

  // strikethrough
  if (run.marks.strikethrough) text = `~~${text}~~`;

  // bold
  if (run.marks.bold) text = `**${text}**`;

  // italic
  if (run.marks.italic) text = `*${text}*`;

  // highlight
  if (run.marks.highlight) text = `==${text}==`;

  // link 最后包裹（outermost）
  if (run.marks.link) text = `[${text}](${run.marks.link})`;

  return text;
}
