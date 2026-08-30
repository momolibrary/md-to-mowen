# NoteAtom 文档格式说明

> 在线文档：<https://mowen.apifox.cn/6682171m0>

NoteAtom 是墨问的文档格式，基于 ProseMirror 风格设计。

---

## 根文档结构

```typescript
interface NoteAtomDoc {
  type: 'doc';
  content: NoteAtomBlockNode[];
}
```

笔记创建/编辑时，`body` 字段即为此结构。

---

## 块节点（Block Nodes）

块节点是文档的顶层内容单元，目前支持三种类型：

### paragraph（段落）

```typescript
interface NoteAtomParagraph {
  type: 'paragraph';
  content: NoteAtomTextNode[]; // 行内节点数组
}
```

- 最通用的块类型，承载文本和行内格式
- `content` 可为空数组（空段落）

### quote（引用块）

```typescript
interface NoteAtomQuote {
  type: 'quote';
  content: NoteAtomTextNode[]; // 行内文本节点（墨问 quote 直接持有 text，不含 paragraph）
}
```

> ⚠️ 墨问 quote 节点的 `content` 是**行内文本数组**（`text` 节点），不是 `paragraph` 数组。
> 多段引用块用 `{ type: 'text', text: '\n' }` 分隔。若误用 `paragraph` 子节点，
> 墨问编辑器加载笔记时会报 `Invalid content for node quote: <paragraph(...)>`（「编辑器内容含有不支持的格式」）。

### image（图片）

```typescript
interface NoteAtomImage {
  type: 'image';
  attrs: {
    uuid: string; // 文件上传后获得的 fileId
    alt: string; // 图片描述文字
    align: 'left' | 'center' | 'right'; // 对齐方式
  };
}
```

- `uuid` 必须是通过上传接口获得的 `fileId`，不能直接使用图片 URL
- 上传流程见 [upload-guide.md](upload-guide.md)

---

## 行内节点（Inline Nodes）

行内节点只能出现在 `paragraph.content` 中。

### text（文本）

```typescript
interface NoteAtomTextNode {
  type: 'text';
  text: string; // 文本内容
  marks?: NoteAtomMark[]; // 可选的格式标记
}
```

---

## 行内标记（Marks）

标记描述文本的格式。**装饰性 marks（bold / italic / strikethrough / highlight / link）可叠加**；`code` **独占**，不可与其它 marks 共存。

```typescript
type NoteAtomMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'strikethrough' }
  | { type: 'link'; attrs: { href: string } };
```

| 标记            | 说明                          |
| --------------- | ----------------------------- |
| `bold`          | 粗体                          |
| `italic`        | 斜体                          |
| `code`          | 行内代码（与其它 marks 互斥） |
| `strikethrough` | 删除线                        |
| `link`          | 超链接，需要 `attrs.href`     |

> ⚠️ 墨问编辑器基于 ProseMirror。若同一 `text` 节点同时带 `bold` 与 `code`，加载时会报
> `Invalid collection of marks for node text: bold,code`（「编辑器内容含有不支持的格式」）。
> 转换层在遇到行内 code 时只保留 `{ type: 'code' }`，丢弃继承的 bold 等 marks
> （典型场景：`` # 标题 `code` ``、``**`code`**``）。

---

## 节点 content 类型对照

> 以下结构来自墨问官方 API 文档 NoteAtom 示例（<https://mowen.apifox.cn/6682171m0>，2025-06-10）。
> 墨问块节点的「行内内容」统一用 `text` 节点数组表达，**不要套 `paragraph`**。

| 节点                         | content 类型           | 说明                                            |
| ---------------------------- | ---------------------- | ----------------------------------------------- |
| `paragraph`                  | `NoteAtomTextNode[]`   | 行内文本                                        |
| `quote`                      | `NoteAtomTextNode[]`   | 行内文本，多段用 `{type:'text',text:'\n'}` 分隔 |
| `codeblock`                  | `NoteAtomTextNode[]`   | 代码文本（`[{type:'text',text:code}]`）         |
| `image`/`audio`/`note`/`pdf` | 无 content，用 `attrs` | 资源型节点                                      |

历史教训：`quote` 与 `codeblock` 都曾误把 `content` 写成块/字符串结构，导致墨问编辑器加载报「不支持的格式」（见 git `00850c1` codeblock 修复、本次 quote 修复）。

---

## 关键约束

墨问不支持以下原生格式，需在转换时处理：

| 原生格式         | 处理方式                                                    |
| ---------------- | ----------------------------------------------------------- |
| 标题（H1/H2/H3） | 原生 `heading` 节点，`attrs.level` 为 `"1"` / `"2"` / `"3"` |
| 标题（H4+）      | `paragraph` + `bold` 标记（墨问仅支持 H1–H3）               |
| 有序/无序列表    | `paragraph` + 文本前缀（`• ` 或 `1. `）                     |
| 代码块           | 每行一个 `paragraph`，文本带 `code` 标记                    |
| 表格             | 渲染为图片后作为 `image` 节点插入                           |
| 分隔线 `---`     | 空 `paragraph`                                              |
| 空行             | 空 `paragraph`                                              |

---

## 完整示例

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "标题文字", "marks": [{ "type": "bold" }] }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "普通文字，" },
        { "type": "text", "text": "粗体", "marks": [{ "type": "bold" }] },
        { "type": "text", "text": "，" },
        {
          "type": "text",
          "text": "链接",
          "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }]
        }
      ]
    },
    {
      "type": "quote",
      "content": [{ "type": "text", "text": "引用内容" }]
    },
    {
      "type": "image",
      "attrs": {
        "uuid": "abc123-TMP",
        "alt": "图片描述",
        "align": "center"
      }
    },
    {
      "type": "paragraph",
      "content": []
    }
  ]
}
```
