import type {
  MASTDocument,
  MASTBlockId,
  MASTBlockNode,
  MASTParagraphBlock,
  MASTQuoteBlock,
  MASTImageBlock,
  MASTAudioBlock,
  MASTCodeBlock,
  MASTNoteBlock,
  MASTPdfBlock,
  MASTTextRun,
  MASTInlineMarks,
} from '../mast/types.js';
import type {
  NoteAtomDoc,
  NoteAtomBlockNode,
  NoteAtomParagraph,
  NoteAtomQuote,
  NoteAtomImage,
  NoteAtomAudio,
  NoteAtomCodeBlock,
  NoteAtomNote,
  NoteAtomPdf,
  NoteAtomTextNode,
  NoteAtomMark,
} from './types.js';

let _idCounter = 0;

function newId(): MASTBlockId {
  return `b_${++_idCounter}`;
}

/**
 * 将 NoteAtom JSON 解析为 MASTDocument。
 */
export function noteAtomToMast(doc: NoteAtomDoc): MASTDocument {
  _idCounter = 0;
  const blocks: Record<MASTBlockId, MASTBlockNode> = {};
  const topLevel: MASTBlockId[] = [];

  for (const node of doc.content) {
    const id = convertNode(node, blocks);
    if (id) topLevel.push(id);
  }

  return { blocks, topLevel };
}

// ── 块节点转换 ─────────────────────────────────────────────────────────────────

function convertNode(node: NoteAtomBlockNode, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId | null {
  switch (node.type) {
    case 'paragraph':
      return convertParagraph(node, blocks);
    case 'quote':
      return convertQuote(node, blocks);
    case 'image':
      return convertImage(node, blocks);
    case 'audio':
      return convertAudio(node, blocks);
    case 'codeblock':
      return convertCodeBlock(node, blocks);
    case 'note':
      return convertNote(node, blocks);
    case 'pdf':
      return convertPdf(node, blocks);
  }
}

function convertParagraph(block: NoteAtomParagraph, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const content: MASTTextRun[] = (block.content ?? []).map(convertTextRun);
  const mast: MASTParagraphBlock = { id, type: 'paragraph', content };
  blocks[id] = mast;
  return id;
}

function convertQuote(block: NoteAtomQuote, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const children: MASTBlockId[] = [];

  for (const child of block.content) {
    const childId = convertParagraph(child, blocks);
    children.push(childId);
  }

  const mast: MASTQuoteBlock = { id, type: 'quote', children };
  blocks[id] = mast;
  return id;
}

function convertImage(block: NoteAtomImage, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const mast: MASTImageBlock = {
    id,
    type: 'image',
    src: `mowen://file/${block.attrs.uuid}`,
    uuid: block.attrs.uuid,
    alt: block.attrs.alt,
    align: block.attrs.align ?? 'center',
  };
  blocks[id] = mast;
  return id;
}

function convertAudio(block: NoteAtomAudio, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const mast: MASTAudioBlock = {
    id,
    type: 'audio',
    src: `mowen://file/${block.attrs['audio-uuid']}`,
    uuid: block.attrs['audio-uuid'],
    showNote: block.attrs['show-note'] ?? '',
  };
  blocks[id] = mast;
  return id;
}

function convertCodeBlock(block: NoteAtomCodeBlock, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const mast: MASTCodeBlock = {
    id,
    type: 'codeblock',
    language: block.attrs.language ?? '',
    content: block.content ?? '',
  };
  blocks[id] = mast;
  return id;
}

function convertNote(block: NoteAtomNote, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const mast: MASTNoteBlock = {
    id,
    type: 'note',
    noteId: block.attrs.uuid,
  };
  blocks[id] = mast;
  return id;
}

function convertPdf(block: NoteAtomPdf, blocks: Record<MASTBlockId, MASTBlockNode>): MASTBlockId {
  const id = newId();
  const mast: MASTPdfBlock = {
    id,
    type: 'pdf',
    src: `mowen://file/${block.attrs.uuid}`,
    uuid: block.attrs.uuid,
  };
  blocks[id] = mast;
  return id;
}

// ── 行内节点转换 ───────────────────────────────────────────────────────────────

function convertTextRun(run: NoteAtomTextNode): MASTTextRun {
  const mast: MASTTextRun = { type: 'text', text: run.text };
  if (!run.marks || run.marks.length === 0) return mast;

  const marks: MASTInlineMarks = {};
  for (const mark of run.marks) {
    switch (mark.type) {
      case 'bold':
        marks.bold = true;
        break;
      case 'italic':
        marks.italic = true;
        break;
      case 'code':
        marks.code = true;
        break;
      case 'strikethrough':
        marks.strikethrough = true;
        break;
      case 'highlight':
        marks.highlight = true;
        break;
      case 'link':
        marks.link = mark.attrs.href;
        break;
    }
  }

  if (Object.keys(marks).length > 0) mast.marks = marks;
  return mast;
}
