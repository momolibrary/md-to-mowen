/**
 * md-to-mowen - 墨问文章发布工具
 *
 * @packageDocumentation
 */

export const VERSION = '1.0.0';

export interface NoteAtomNode {
  type: 'paragraph' | 'image' | 'quote';
  attrs?: Record<string, unknown>;
  content?: NoteAtomNode[] | NoteAtomInline[];
}

export interface NoteAtomInline {
  type: 'text';
  text: string;
  marks?: Array<{
    type: 'bold' | 'italic' | 'link' | 'code' | 'strikethrough';
    attrs?: Record<string, unknown>;
  }>;
}

export interface NoteAtomDoc {
  type: 'doc';
  content: NoteAtomNode[];
}
