/**
 * NoteAtom 类型定义
 * 墨问的 ProseMirror 风格文档格式
 */

export interface NoteAtomDoc {
  type: 'doc';
  content: NoteAtomBlockNode[];
}

export type NoteAtomBlockNode =
  | NoteAtomParagraph
  | NoteAtomQuote
  | NoteAtomImage
  | NoteAtomAudio
  | NoteAtomCodeBlock
  | NoteAtomNote
  | NoteAtomPdf;

export interface NoteAtomParagraph {
  type: 'paragraph';
  content: NoteAtomTextNode[];
}

export interface NoteAtomQuote {
  type: 'quote';
  // 墨问 quote 节点直接持有行内文本（text 节点数组），不含 paragraph。
  // 多段引用用 { type: 'text', text: '\n' } 分隔。见 docs/architecture/api/noteatom.md
  content: NoteAtomTextNode[];
}

export interface NoteAtomImage {
  type: 'image';
  attrs: {
    uuid: string;
    alt: string;
    align: 'left' | 'center' | 'right';
  };
}

export interface NoteAtomAudio {
  type: 'audio';
  attrs: {
    'audio-uuid': string;
    'show-note': string;
  };
}

export interface NoteAtomCodeBlock {
  type: 'codeblock';
  attrs: {
    language: string;
  };
  content: NoteAtomTextNode[];
}

export interface NoteAtomNote {
  type: 'note';
  attrs: {
    uuid: string; // 被引用的笔记 ID
  };
}

export interface NoteAtomPdf {
  type: 'pdf';
  attrs: {
    uuid: string; // PDF 文件 ID
  };
}

export interface NoteAtomTextNode {
  type: 'text';
  text: string;
  marks?: NoteAtomMark[];
}

export type NoteAtomMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'strikethrough' }
  | { type: 'highlight' }
  | { type: 'link'; attrs: { href: string } };
