import type {
  MASTDocument,
  MASTBlockNode,
  MASTImageBlock,
  MASTAudioBlock,
  MASTParagraphBlock,
  MASTHeadingBlock,
  MASTQuoteBlock,
  MASTCodeBlock,
  MASTNoteBlock,
  MASTPdfBlock,
  MASTInlineMarks,
} from '../mast/types.js';
import type {
  NoteAtomDoc,
  NoteAtomBlockNode,
  NoteAtomParagraph,
  NoteAtomHeading,
  NoteAtomImage,
  NoteAtomAudio,
  NoteAtomCodeBlock,
  NoteAtomNote,
  NoteAtomPdf,
  NoteAtomTextNode,
  NoteAtomMark,
} from './types.js';

/**
 * 将 MASTDocument 序列化为 NoteAtom JSON。
 * 所有 MASTImageBlock 必须已有 uuid（资源阶段完成后）。
 */
export function mastToNoteAtom(doc: MASTDocument): NoteAtomDoc {
  const content: NoteAtomBlockNode[] = [];

  for (const id of doc.topLevel) {
    const block = doc.blocks[id];
    if (block) {
      const nodes = convertBlock(block, doc);
      content.push(...nodes);
    }
  }

  return { type: 'doc', content };
}

// ── 块节点转换 ─────────────────────────────────────────────────────────────────

function convertBlock(block: MASTBlockNode, doc: MASTDocument): NoteAtomBlockNode[] {
  switch (block.type) {
    case 'paragraph':
      return [convertParagraph(block)];
    case 'heading':
      return [convertHeading(block)];
    case 'quote':
      return [convertQuote(block, doc)];
    case 'image':
      return [convertImage(block)];
    case 'audio':
      return [convertAudio(block)];
    case 'codeblock':
      return [convertCodeBlock(block)];
    case 'note':
      return [convertNote(block)];
    case 'pdf':
      return [convertPdf(block)];
  }
}

function convertParagraph(block: MASTParagraphBlock): NoteAtomParagraph {
  return {
    type: 'paragraph',
    content: block.content.map(convertTextRun),
  };
}

function convertHeading(block: MASTHeadingBlock): NoteAtomHeading {
  return {
    type: 'heading',
    attrs: { level: block.level },
    content: block.content.map(convertTextRun),
  };
}

function convertQuote(block: MASTQuoteBlock, doc: MASTDocument): NoteAtomBlockNode {
  // 墨问 quote 节点的 content 是行内文本数组（不含 paragraph）。
  // 收集所有子段落（含嵌套 quote 展平项），把 text runs 合并为单个 text 数组，
  // 多段之间用 { type: 'text', text: '\n' } 分隔（与 <br> 的既有约定一致）。
  const paragraphs: MASTParagraphBlock[] = [];

  for (const childId of block.children) {
    const child = doc.blocks[childId];
    if (!child) continue;

    if (child.type === 'paragraph') {
      paragraphs.push(child as MASTParagraphBlock);
    }
    // quote 内嵌套 quote：展平为段落
    else if (child.type === 'quote') {
      const quoteChild = child as MASTQuoteBlock;
      for (const grandChildId of quoteChild.children) {
        const grandChild = doc.blocks[grandChildId];
        if (grandChild && grandChild.type === 'paragraph') {
          paragraphs.push(grandChild as MASTParagraphBlock);
        }
      }
    }
  }

  const content: NoteAtomTextNode[] = [];
  paragraphs.forEach((p, i) => {
    if (i > 0) content.push({ type: 'text', text: '\n' });
    content.push(...p.content.map(convertTextRun));
  });

  return { type: 'quote', content };
}

function convertImage(block: MASTImageBlock): NoteAtomImage {
  if (!block.uuid) {
    throw new Error(
      `MASTImageBlock ${block.id} has no uuid — run asset processing before serialization`
    );
  }
  return {
    type: 'image',
    attrs: {
      uuid: block.uuid,
      alt: block.alt,
      align: block.align,
    },
  };
}

function convertAudio(block: MASTAudioBlock): NoteAtomAudio {
  if (!block.uuid) {
    throw new Error(
      `MASTAudioBlock ${block.id} has no uuid — run asset processing before serialization`
    );
  }
  return {
    type: 'audio',
    attrs: {
      'audio-uuid': block.uuid,
      'show-note': block.showNote,
    },
  };
}

function convertCodeBlock(block: MASTCodeBlock): NoteAtomCodeBlock {
  return {
    type: 'codeblock',
    attrs: {
      language: block.language,
    },
    content: [{ type: 'text', text: block.content }],
  };
}

function convertNote(block: MASTNoteBlock): NoteAtomNote {
  return {
    type: 'note',
    attrs: {
      uuid: block.noteId,
    },
  };
}

function convertPdf(block: MASTPdfBlock): NoteAtomPdf {
  if (!block.uuid) {
    throw new Error(
      `MASTPdfBlock ${block.id} has no uuid — run asset processing before serialization`
    );
  }
  return {
    type: 'pdf',
    attrs: {
      uuid: block.uuid,
    },
  };
}

// ── 行内节点转换 ───────────────────────────────────────────────────────────────

function convertTextRun(run: {
  type: 'text';
  text: string;
  marks?: MASTInlineMarks;
}): NoteAtomTextNode {
  const node: NoteAtomTextNode = { type: 'text', text: run.text };

  if (!run.marks) return node;

  // 墨问编辑器（ProseMirror）中 code 与其它 marks 互斥。
  // 叠加 bold/code 等会报：Invalid collection of marks for node text: bold,code
  if (run.marks.code) {
    node.marks = [{ type: 'code' }];
    return node;
  }

  const marks: NoteAtomMark[] = [];

  // 按优先级顺序：strikethrough → bold → italic → highlight → link
  if (run.marks.strikethrough) marks.push({ type: 'strikethrough' });
  if (run.marks.bold) marks.push({ type: 'bold' });
  if (run.marks.italic) marks.push({ type: 'italic' });
  if (run.marks.highlight) marks.push({ type: 'highlight' });
  if (run.marks.link) marks.push({ type: 'link', attrs: { href: run.marks.link } });

  if (marks.length > 0) node.marks = marks;
  return node;
}
