# md-to-mowen：概念与架构

> 本文档供实现此项目的 Agent 参考。
> 综合自：md-to-lark 架构、墨问开放 API，以及 `${DEV_HOME}/Downloads/skills/mowen` 中现有的 mowen skill。

---

## 1. 项目概述

**md-to-mowen** 是一个 TypeScript/Node.js CLI 工具，通过墨问开放 API 将 Markdown（GFM）转换为墨问笔记。它遵循带有中间 AST 的类型化流水线、阶段缓存、资源上传以及双向格式支持。

### 目标

- 一条命令将 Markdown 文件转换为墨问笔记
- 保留行内格式（粗体、斜体、代码、删除线、链接）
- 处理图片：将本地文件和远程 URL 上传到墨问 OSS
- 将 Markdown 表格渲染为图片（墨问不原生支持表格）
- 支持 dry-run 模式，仅验证不发布
- 提供各阶段产物用于调试流水线每个步骤
- 支持双向转换：NoteAtom → Markdown（用于读取笔记）

### 非目标（v1）

- Mermaid 图表渲染（后续可添加）
- 音频/PDF 上传
- 笔记列表或删除
- 实时同步 / watch 模式

---

## 2. NoteAtom 类型系统

NoteAtom 是墨问的 ProseMirror 风格文档格式，比飞书的 BTT 格式简单得多。

### 根文档

```typescript
interface NoteAtomDoc {
  type: 'doc';
  content: NoteAtomBlockNode[];
}
```

### 块节点类型

```typescript
type NoteAtomBlockNode = NoteAtomParagraph | NoteAtomQuote | NoteAtomImage;

// Paragraph：通用文本容器
interface NoteAtomParagraph {
  type: 'paragraph';
  content: NoteAtomTextNode[];
}

// Quote：引用块容器
interface NoteAtomQuote {
  type: 'quote';
  content: NoteAtomParagraph[];
}

// Image：已上传文件引用
interface NoteAtomImage {
  type: 'image';
  attrs: {
    uuid: string; // 上传 API 返回的 fileId
    alt: string;
    align: 'left' | 'center' | 'right';
  };
}
```

### 行内节点类型

```typescript
// 带可选标记的文本段
interface NoteAtomTextNode {
  type: 'text';
  text: string;
  marks?: NoteAtomMark[];
}

// 标记类型（行内格式）
type NoteAtomMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'strikethrough' }
  | { type: 'link'; attrs: { href: string } };
```

### 关键约束

1. **无原生标题** — H1–H6 全部映射为 `paragraph` + `bold` 标记
2. **无原生列表** — 列表项映射为带 `• ` 或 `N. ` 前缀文本的 `paragraph`
3. **无原生代码块** — 围栏代码块映射为每行带 `code` 标记的 `paragraph` 节点，或渲染为图片
4. **无原生表格** — 表格必须渲染为 PNG 并作为 `image` 节点插入
5. **无原生分隔线** — `---` 映射为空 `paragraph`

---

## 3. Markdown → NoteAtom 映射

| Markdown 元素          | NoteAtom 输出                  | 备注                   |
| ---------------------- | ------------------------------ | ---------------------- |
| `# H1`                 | `paragraph` + `bold` 标记      | 标题层级丢失           |
| `## H2`                | `paragraph` + `bold` 标记      |                        |
| `### H3`               | `paragraph` + `bold` 标记      |                        |
| `#### H4+`             | `paragraph` + `bold` 标记      |                        |
| `- item`               | 带 `• ` 前缀的 `paragraph`     | 嵌套列表：缩进前缀     |
| `1. item`              | 带 `1. ` 前缀的 `paragraph`    | 每个列表独立计数       |
| `> quote`              | `quote` 节点                   | 嵌套引用：展平处理     |
| `**bold**`             | `text` + `bold` 标记           |                        |
| `*italic*`             | `text` + `italic` 标记         |                        |
| `` `code` ``           | `text` + `code` 标记           |                        |
| `~~strike~~`           | `text` + `strikethrough` 标记  |                        |
| `[text](url)`          | `text` + `link` 标记           |                        |
| `![alt](src)`          | `image` 节点                   | 需先上传               |
| ` ```lang\ncode\n``` ` | 每行 `paragraph` + `code` 标记 | 或渲染为图片           |
| `\| table \|`          | `image` 节点                   | Playwright 渲染 → 上传 |
| `---`                  | 空 `paragraph`                 |                        |
| 空行                   | 空 `paragraph`                 |                        |

### 行内标记优先级（序列化回 Markdown 时）

NoteAtom → Markdown 转换时，按以下顺序应用标记以避免嵌套问题：

1. `code`（最先包裹，内部不含其他标记）
2. `strikethrough`
3. `bold`
4. `italic`
5. `link`（最后包裹）

---

## 4. 流水线架构

```
Markdown 文件
    │
    ▼
[00-source]   读取文件，检测资源，应用预设
    │
    ▼
[01-hast]     Markdown → HAST  (unified + remark-parse + remark-gfm)
    │
    ▼
[02-mast]     HAST → MAST      (类型化中间 AST，见第 5 节)
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

每个阶段将 JSON 产物写入 `--cache-dir` 用于调试（与 md-to-lark 的 stage-cache 模式一致）。

---

## 5. MAST — Mowen AST（中间表示）

MAST 是 HAST 与 NoteAtom 之间的标准中间格式。它镜像 NoteAtom 的结构，但增加了图片上传前的状态并保留了源元数据。

```typescript
// src/mast/types.ts

export type MASTBlockId = `b_${string}`;

export interface MASTDocument {
  blocks: Record<MASTBlockId, MASTBlockNode>;
  topLevel: MASTBlockId[];
}

export type MASTBlockNode = MASTParagraphBlock | MASTQuoteBlock | MASTImageBlock;

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
  link?: string; // href
}
```

### 为什么需要 MAST？

- 将 HAST 解析与 NoteAtom 序列化解耦
- 允许资源上传在序列化前更新 `uuid` 字段
- 支持双向转换（NoteAtom → MAST → Markdown）
- 为测试提供稳定的类型检查表示

---

## 6. 项目结构

```
md-to-mowen/
├── src/
│   ├── cli/
│   │   └── index.ts              # CLI 入口（commander）
│   ├── commands/
│   │   └── publish-md/
│   │       ├── command.ts        # 主发布命令
│   │       ├── args.ts           # CLI 参数定义
│   │       └── presets/          # Markdown 预设（zh-format 等）
│   ├── mast/
│   │   ├── types.ts              # MAST 类型定义
│   │   └── to-markdown.ts        # MAST → Markdown 序列化器
│   ├── pipeline/
│   │   ├── md-to-hast.ts         # Markdown → HAST
│   │   └── hast-to-mast.ts       # HAST → MAST
│   ├── noteatom/
│   │   ├── types.ts              # NoteAtom 类型定义
│   │   └── from-mast.ts          # MAST → NoteAtom 序列化器
│   ├── mowen/
│   │   ├── client.ts             # 墨问 API 客户端（fetch）
│   │   └── upload.ts             # 图片上传（两步 OSS 流程）
│   ├── publish/
│   │   ├── process-file.ts       # 单文件流水线编排
│   │   ├── asset-adapter.ts      # 图片检测与上传协调
│   │   ├── table-renderer.ts     # Markdown 表格 → PNG（Playwright）
│   │   └── stage-cache.ts        # 将流水线产物写入磁盘
│   └── shared/
│       ├── retry.ts              # 指数退避重试
│       └── image-metadata.ts     # 图片尺寸提取
├── tests/
├── tests-e2e/
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 7. 墨问 API 集成

> API 完整文档见：
>
> - **在线文档**：<https://mowen.apifox.cn/>
> - **本地文档**：[docs/api/README.md](api/README.md)（含接口详情、NoteAtom 格式、上传流程、错误码）

### 客户端接口摘要

```typescript
// src/mowen/client.ts — 实现时参考 docs/api/endpoints.md

interface MowenClient {
  createNote(body: NoteAtomDoc, settings?: NoteSettings): Promise<{ noteId: string }>;
  editNote(noteId: string, body: NoteAtomDoc): Promise<void>;
  setNotePrivacy(noteId: string, privacy: NotePrivacy): Promise<void>;
  uploadPrepare(fileType: FileType, fileName: string): Promise<UploadForm>;
  uploadViaUrl(fileType: FileType, url: string, fileName?: string): Promise<UploadedFile>;
}

type FileType = 1 | 2 | 3; // 1=图片, 2=音频, 3=PDF
```

---

## 8. 表格渲染策略

墨问不原生支持表格，必须将表格渲染为 PNG 图片。

### 渲染流水线

```
Markdown 表格语法
    ↓
解析为行列矩阵
    ↓
生成 HTML + CSS（专业金融风格）
    ↓
Playwright 无头 Chromium → PNG
    ↓
上传到墨问 OSS → fileId
    ↓
将 MAST 中的表格替换为 MASTImageBlock { uuid: fileId, isTable: true }
```

### 实现参考

`${DEV_HOME}/Downloads/skills/mowen/` 中现有的 `table2image_pro.py` 有完整可用的实现，将其 HTML/CSS 模板移植到 TypeScript。

关键 CSS 参数：

- 宽度：1000px，高度：auto（200–2000px）
- 表头：深蓝渐变 `#1e3a5f → #2d4a6f`，白色文字
- 斑马纹：`#fafbfc / #ffffff`
- 数字：右对齐，等宽字体（SF Mono）
- 圆角：8px，柔和阴影

### Playwright 配置

```typescript
// src/publish/table-renderer.ts
import { chromium } from 'playwright';

async function renderTableToPng(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);
  const element = await page.$('table');
  const buffer = await element!.screenshot({ type: 'png' });
  await browser.close();
  return buffer;
}
```

---

## 9. 资源处理

### 检测

在 HAST → MAST 转换过程中，收集所有图片来源：

- `<img src="...">` 元素
- 独立图片段落

### 上传策略

| 来源类型      | 策略                              |
| ------------- | --------------------------------- |
| 本地文件路径  | 读取文件 → 两步 OSS 上传          |
| 远程 HTTP URL | 使用 `/upload/url` 接口（更简单） |
| Data URI      | 解码 → 两步 OSS 上传              |

### 更新

上传后，用返回的 `fileId` 更新 `MASTImageBlock.uuid`。MAST → NoteAtom 序列化器随后将 `uuid` 用于 `attrs.uuid` 字段。

---

## 10. CLI 接口

```bash
# 将 markdown 文件发布为新笔记（草稿）
md-to-mowen publish --input article.md

# 发布并添加标签
md-to-mowen publish --input article.md --tags "tech,ai"

# 更新已有笔记
md-to-mowen publish --input article.md --note-id AwsdqiQ5EQeoVW3pNWeOP

# Dry run（验证流水线，不调用 API）
md-to-mowen publish --input article.md --dry-run

# 自动发布（非草稿）
md-to-mowen publish --input article.md --auto-publish

# 保存流水线产物用于调试
md-to-mowen publish --input article.md --cache-dir ./pipeline-cache

# 应用预设转换
md-to-mowen publish --input article.md --preset zh-format
```

### 环境变量

```env
MOWEN_API_KEY=your_api_key_here
```

---

## 11. 关键设计决策

### D1：MAST 作为中间层

尽管 NoteAtom 结构简单，MAST 仍将解析与序列化解耦，支持：

- 序列化前的资源上传更新
- 双向转换（NoteAtom → MAST → Markdown）
- 独立对每个转换阶段进行单元测试

### D2：默认草稿

所有笔记以 `autoPublish: false` 创建，用户需在墨问手动发布，防止意外公开。

### D3：表格始终渲染为图片

墨问不支持表格。与其静默丢弃，不如始终渲染为图片。这与现有 skill 的行为一致，输出效果更好。

### D4：代码块作为样式化段落

围栏代码块映射为一系列 `paragraph` 节点，每行带 `code` 标记。这保留了内容（而非丢弃）。另一种方案是渲染为图片——通过 `--code-block-style paragraph|image` 使其可配置。

### D5：标题层级展平

H1–H6 全部 → 粗体段落。这是已知的有损映射，需明确记录。反向转换（NoteAtom → Markdown）无法恢复标题层级。

### D6：保留链接标记

现有 skill 会去除链接。本项目将其保留为文本节点上的 `link` 标记，与 NoteAtom schema 的 `link` 标记类型一致。

---

## 12. 双向转换（NoteAtom → Markdown）

用于从墨问读取笔记（未来：若添加 GET note API），实现：

```
NoteAtom JSON
    ↓
解析为 MAST
    ↓
MAST → Markdown (src/mast/to-markdown.ts)
```

### NoteAtom → MAST 规则

| NoteAtom                   | MAST                              |
| -------------------------- | --------------------------------- |
| `paragraph` + `bold` 文本  | `paragraph`（标题层级丢失）       |
| 带 `• ` 前缀的 `paragraph` | `paragraph`（列表标记保留为文本） |
| `quote`                    | `quote`                           |
| `image`                    | 带 uuid 的 `image`（无本地 src）  |

### MAST → Markdown 规则

| MAST                       | Markdown                               |
| -------------------------- | -------------------------------------- |
| `paragraph`                | `\n\ntext\n\n`                         |
| `quote`                    | `> text`                               |
| `image`（有 uuid，无 src） | `![alt](https://mowen.cn/file/{uuid})` |
| `text` + `bold`            | `**text**`                             |
| `text` + `italic`          | `*text*`                               |
| `text` + `code`            | `` `text` ``                           |
| `text` + `strikethrough`   | `~~text~~`                             |
| `text` + `link`            | `[text](url)`                          |

---

## 13. 依赖

```json
{
  "dependencies": {
    "unified": "^11",
    "remark-parse": "^11",
    "remark-gfm": "^4",
    "remark-rehype": "^11",
    "rehype-stringify": "^10",
    "unist-util-visit": "^5",
    "hast-util-to-string": "^3",
    "commander": "^12",
    "dotenv": "^16",
    "form-data": "^4",
    "node-fetch": "^3"
  },
  "devDependencies": {
    "playwright": "^1",
    "typescript": "^5",
    "tsx": "^4",
    "@types/node": "^20",
    "vitest": "^1"
  }
}
```

---

## 14. 参考文件

| 资源                   | 路径                                       |
| ---------------------- | ------------------------------------------ |
| 参考项目（md-to-lark） | `${DEV_HOME}/Documents/github/md-to-lark/` |
| 现有 mowen skill       | `${DEV_HOME}/Downloads/skills/mowen/`      |
| 墨问 API 在线文档      | `https://mowen.apifox.cn/`                 |
| 墨问 API 本地文档      | `docs/api/README.md`                       |
| 墨问 Base URL          | `https://open.mowen.cn`                    |
| 笔记 URL 格式          | `https://mowen.cn/note/{noteId}`           |

### 现有 skill 中需移植/参考的关键文件

| 文件                 | 移植内容                                     |
| -------------------- | -------------------------------------------- |
| `md2noteatom.py`     | 转换逻辑（用 TypeScript 重写，支持完整标记） |
| `table2image_pro.py` | 表格渲染的 HTML/CSS 模板                     |
| `upload_image.sh`    | OSS multipart 上传流程                       |
| `publish_lint.py`    | 质量检查（可选，实现为警告）                 |
| `mowen.sh`           | API 调用模式                                 |
