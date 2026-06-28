// MAST — Mowen AST（中间表示）
// HAST 与 NoteAtom 之间的标准中间格式

export type MASTBlockId = `b_${string}`;

export interface MASTDocument {
  blocks: Record<MASTBlockId, MASTBlockNode>;
  topLevel: MASTBlockId[];
}

export type MASTBlockNode =
  | MASTParagraphBlock
  | MASTQuoteBlock
  | MASTImageBlock
  | MASTAudioBlock
  | MASTCodeBlock
  | MASTNoteBlock
  | MASTPdfBlock;

export interface MASTParagraphBlock {
  id: MASTBlockId;
  type: 'paragraph';
  content: MASTInlineNode[];
}

export interface MASTQuoteBlock {
  id: MASTBlockId;
  type: 'quote';
  children: MASTBlockId[]; // 段落子节点的 ID
}

export interface MASTImageBlock {
  id: MASTBlockId;
  type: 'image';
  src: string; // 本地路径或远程 URL（上传前）
  uuid?: string; // 上传后的 fileId（资源阶段后）
  alt: string;
  align: 'left' | 'center' | 'right';
  isTable?: boolean; // 若由 markdown 表格渲染则为 true
}

export interface MASTAudioBlock {
  id: MASTBlockId;
  type: 'audio';
  src: string; // 本地路径或远程 URL（上传前）
  uuid?: string; // 上传后的 fileId（资源阶段后）
  showNote: string; // show-note 文本（时间轴注释）
}

export interface MASTCodeBlock {
  id: MASTBlockId;
  type: 'codeblock';
  language: string; // 语言标识（如 js, ts, python）
  content: string; // 代码内容（保留原始换行）
}

export interface MASTNoteBlock {
  id: MASTBlockId;
  type: 'note';
  noteId: string; // 被引用的笔记 ID
}

export interface MASTPdfBlock {
  id: MASTBlockId;
  type: 'pdf';
  src: string; // 本地路径或 fileId（上传前/后）
  uuid?: string; // 上传后的 fileId（资源阶段后）
}

export type MASTInlineNode = MASTTextRun;

export interface MASTTextRun {
  type: 'text';
  text: string;
  marks?: MASTInlineMarks;
}

export interface MASTInlineMarks {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  highlight?: boolean;
  link?: string; // href
}
