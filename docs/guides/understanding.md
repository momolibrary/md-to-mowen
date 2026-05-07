# 理解仓库原理

> 本文档帮助想要深入了解 md-to-mowen 项目架构的开发者理解其设计思路。

## 项目定位

**md-to-mowen** 是一个 TypeScript CLI 工具，将 Markdown（GFM）转换为墨问笔记。它的核心价值是解决墨问笔记格式的限制——墨问不支持原生标题、表格、代码块，本项目通过 AST 转换流水线将这些元素适配到墨问的格式。

## 流水线架构

项目的核心是一个 6 阶段流水线：

```
Markdown 文件
    │
    ▼
[00-source]   读取文件，检测资源，应用预设
    │
    ▼
[01-hast]     Markdown → HAST (unified + remark-parse + remark-gfm)
    │
    ▼
[02-mast]     HAST → MAST (类型化中间 AST)
    │
    ▼
[03-assets]   上传图片 & 渲染表格 → 用 fileId 更新 MAST
    │
    ▼
[04-noteatom] MAST → NoteAtom JSON
    │
    ▼
[05-publish]  POST /note/create 或 /note/edit → 返回 noteId + URL
```

### 各阶段职责

| 阶段     | 输入                     | 输出                     | 职责                                       |
| -------- | ------------------------ | ------------------------ | ------------------------------------------ |
| source   | Markdown 文件            | 原始文本                 | 读取文件，检测资源引用，应用预设           |
| hast     | 原始文本                 | HAST 树                  | 使用 unified 生态解析 Markdown 为 HTML AST |
| mast     | HAST 树                  | MAST 文档                | 将 HAST 转换为项目专用的中间 AST           |
| assets   | MAST 文档（图片无 uuid） | MAST 文档（图片有 uuid） | 上传本地/远程图片，渲染表格为 PNG          |
| noteatom | MAST 文档                | NoteAtom JSON            | 序列化为墨问的 ProseMirror 格式            |
| publish  | NoteAtom JSON            | noteId + URL             | 调用墨问 API 创建或编辑笔记                |

### 阶段缓存

通过 `--cache-dir` 可以保存每个阶段的产物，用于调试：

```bash
md-to-mowen publish -i article.md --cache-dir ./pipeline-cache
```

产物文件：

- `01-hast.json` — HAST 树
- `02-mast.json` — MAST 文档（图片无 uuid）
- `03-mast-with-assets.json` — MAST 文档（图片已上传）
- `04-noteatom.json` — NoteAtom JSON

## MAST 中间层

### 为什么需要 MAST？

尽管 NoteAtom 结构简单，MAST 仍引入中间层，原因：

1. **解耦解析与序列化** — HAST 解析逻辑与 NoteAtom 序列化逻辑分离
2. **资源上传时机** — 图片上传需要在序列化前完成，MAST 提供了更新 uuid 的时机
3. **双向转换** — 支持 NoteAtom → MAST → Markdown（读取笔记）
4. **独立测试** — 每个转换阶段可以单独进行单元测试

### MAST 类型系统

```typescript
// 块节点类型
type MASTBlockNode =
  | MASTParagraphBlock // 段落
  | MASTQuoteBlock // 引用
  | MASTImageBlock // 图片
  | MASTAudioBlock // 音频
  | MASTCodeBlock; // 代码块

// 行内标记
interface MASTInlineMarks {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  link?: string; // href
}
```

MAST 的结构镜像 NoteAtom，但增加了：

- 图片上传前的 `src` 字段（本地路径或远程 URL）
- 上传后的 `uuid` 字段（OSS fileId）
- 表格标记 `isTable: true`

## NoteAtom 类型系统

NoteAtom 是墨问的 ProseMirror 风格文档格式。

### 核心限制

墨问笔记格式有以下限制：

| 限制         | 解决方案                                       |
| ------------ | ---------------------------------------------- |
| 无原生标题   | H1-H6 → `paragraph` + `bold` 标记              |
| 无原生列表   | 列表项 → 带 `• ` 或 `1. ` 前缀的 `paragraph`   |
| 无原生代码块 | 每行带 `code` 标记的 `paragraph`，或渲染为图片 |
| 无原生表格   | 渲染为 PNG 图片，作为 `image` 节点插入         |

### NoteAtom 结构

```typescript
interface NoteAtomDoc {
  type: 'doc';
  content: NoteAtomBlockNode[];
}

type NoteAtomBlockNode =
  | { type: 'paragraph'; content: NoteAtomTextNode[] }
  | { type: 'quote'; content: NoteAtomParagraph[] }
  | { type: 'image'; attrs: { uuid: string; alt: string; align: string } }
  | { type: 'audio'; attrs: { uuid: string; showNote: string } }
  | { type: 'codeblock'; attrs: { language: string }; content: NoteAtomTextNode[] };

interface NoteAtomTextNode {
  type: 'text';
  text: string;
  marks?: NoteAtomMark[];
}

type NoteAtomMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'strikethrough' }
  | { type: 'link'; attrs: { href: string } };
```

## 关键设计决策

### D1: MAST 作为中间层

引入中间层而非直接 HAST → NoteAtom，支持资源上传时机控制和双向转换。

### D2: 默认草稿

所有笔记以 `autoPublish: false` 创建，防止意外公开。用户需在墨问手动发布。

### D3: 表格始终渲染为图片

墨问不支持表格。与其静默丢弃，渲染为图片效果更好。

### D4: 代码块可配置

通过 `--code-block-style` 选择：

- `paragraph` — 每行带 code 标记的段落
- `codeblock` — 使用墨问原生代码块节点

### D5: 标题层级展平

H1-H6 全部转为粗体段落，这是已知的有损映射。反向转换无法恢复层级。

### D6: 保留链接标记

与其他转换工具不同，本项目保留链接为 `link` 标记。

## 项目结构导航

```
src/
├── cli/                  # CLI 入口 (commander)
├── pipeline/             # Markdown → HAST → MAST 转换
│   ├── md-to-hast.ts     # unified 解析
│   └── hast-to-mast.ts   # HAST → MAST 转换
├── mast/                 # 中间 AST 类型
│   ├── types.ts          # 类型定义
│   └── to-markdown.ts    # 反向序列化
├── noteatom/             # NoteAtom 类型与转换
│   ├── types.ts          # 类型定义
│   ├── from-mast.ts      # MAST → NoteAtom
│   └── to-mast.ts        # NoteAtom → MAST
├── mowen/                # API 客户端
│   ├── client.ts         # fetch 封装
│   └ upload.ts           # 两步 OSS 上传
├── publish/              # 流水线编排
│   ├── process-file.ts   # 单文件流水线
│   ├── asset-adapter.ts  # 资源处理协调
│   └── table-renderer.ts # 表格 → PNG
└── shared/               # 工具函数
```

## 下一步

- 想要复刻此模式？见 [replication.md](replication.md)
- 想要快速使用？见 [quick-start.md](quick-start.md)
- 想要深入了解架构细节？见 [architecture/CONCEPT.md](architecture/CONCEPT.md)
