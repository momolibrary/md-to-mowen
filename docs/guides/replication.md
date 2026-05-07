# 复刻核心模式

> 本文档帮助想要将 md-to-mowen 的设计模式应用到其他平台的开发者。

## 模式概述

md-to-mowen 的核心模式是 **AST 中间层流水线**，适用于任何格式转换场景：

```
源格式 → 标准化 AST → 中间 AST → 目标格式
```

这个模式解决的核心问题：**源格式和目标格式的结构不匹配，需要中间层做适配**。

## 设计 AST 中间层

### 判断是否需要中间层

需要中间层的场景：

| 场景                       | 原因                          |
| -------------------------- | ----------------------------- |
| 资源需要异步处理（上传）   | 序列化前需要完成上传并获取 ID |
| 源格式和目标格式结构差异大 | 直接转换逻辑复杂，难以维护    |
| 需要双向转换               | 中间层可以作为转换枢纽        |
| 需要对每个阶段做测试       | 中间层提供清晰的阶段边界      |

不需要中间层的场景：

| 场景           | 原因             |
| -------------- | ---------------- |
| 结构一对一映射 | 直接转换足够简单 |
| 无资源处理     | 无异步时机需求   |

### 设计中间层类型

参考 MAST 的设计：

```typescript
// 1. 块节点类型 — 镜像目标格式，但保留源格式元数据
type MASTBlockNode = MASTParagraphBlock | MASTImageBlock; // 图片保留 src（源）+ uuid（目标）

// 2. 行内节点 — 保留所有可能的标记
interface MASTInlineMarks {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string; // href
}

// 3. 使用 ID 引用而非嵌套
interface MASTDocument {
  blocks: Record<MASTBlockId, MASTBlockNode>; // ID → Block 映射
  topLevel: MASTBlockId[]; // 顶层块的 ID 序列
}
```

关键设计点：

1. **块节点镜像目标格式** — 但增加源格式字段（如图片的 `src`）
2. **行内标记保留所有可能性** — 不要过早丢弃
3. **ID 引用而非嵌套** — 方便更新（如图片上传后更新 uuid）

## 资源上传流程

### 两步 OSS 上传

墨问采用两步 OSS 上传流程：

```
1. 调用 /upload/prepare → 获取 OSS 上传表单
2. POST 到 OSS endpoint → 上传文件
3. 返回 fileId → 更新 MAST
```

实现模板：

```typescript
async function uploadImage(client: MowenClient, filePath: string): Promise<string> {
  // 步骤 1：获取上传表单
  const form = await client.uploadPrepare(1, fileName); // fileType=1 图片

  // 步骤 2：POST 到 OSS
  const formData = new FormData();
  formData.append('key', form.key);
  formData.append('policy', form.policy);
  formData.append('OSSAccessKeyId', form.accessKeyId);
  formData.append('signature', form.signature);
  formData.append('success_action_status', '200');
  formData.append('file', fileBuffer);

  await fetch(form.host, { method: 'POST', body: formData });

  // 步骤 3：fileId 即 form.key 中的 UUID 部分
  return extractFileId(form.key);
}
```

### 远程 URL 上传

远程 URL 可以使用简化接口：

```typescript
async function uploadViaUrl(client: MowenClient, url: string): Promise<string> {
  const result = await client.uploadViaUrl(1, url); // fileType=1 图片
  return result.fileId;
}
```

## 表格渲染策略

墨问不支持原生表格，需要渲染为图片。

### 渲染流程

```
Markdown 表格
    ↓ 解析
行列矩阵
    ↓ 生成
HTML + CSS
    ↓ Playwright
PNG 图片
    ↓ 上传
fileId → MAST
```

### CSS 模板要点

```css
table {
  width: 1000px;
  font-family: system-ui, sans-serif;
}

thead {
  background: linear-gradient(to bottom, #1e3a5f, #2d4a6f);
  color: white;
}

/* 斑马纹 */
tbody tr:nth-child(even) {
  background: #fafbfc;
}
tbody tr:nth-child(odd) {
  background: #ffffff;
}

/* 数字右对齐 */
td:has(only-numbers) {
  text-align: right;
  font-family: 'SF Mono', monospace;
}
```

### Playwright 配置

```typescript
import { chromium } from 'playwright';

async function renderTableToPng(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const table = await page.$('table');
  const buffer = await table!.screenshot({ type: 'png' });
  await browser.close();
  return buffer;
}
```

## CLI 命令设计

### 命令结构

```typescript
// 主命令
md-to-mowen publish -i <path> [options]

// 子命令
md-to-mowen privacy --note-id <id> --visibility public|private
md-to-mowen to-markdown -i note.json -o output.md
md-to-mowen config
```

### 参数设计原则

| 类型     | 示例                       | 用途         |
| -------- | -------------------------- | ------------ |
| 必填参数 | `-i, --input <path>`       | 核心输入     |
| 可选参数 | `--tags <tags>`            | 附加信息     |
| 开关参数 | `--auto-publish`           | boolean 标记 |
| 调试参数 | `--dry-run`, `--cache-dir` | 开发调试     |

### 配置文件

支持 `.md-to-mowen.json` 保存常用配置：

```json
{
  "defaultTags": "tech,programming",
  "autoPublish": false,
  "codeBlockStyle": "paragraph"
}
```

CLI 参数优先级高于配置文件。

## 测试策略

### 阶段测试

每个转换阶段独立测试：

```typescript
// HAST → MAST
describe('hastToMast', () => {
  it('converts paragraph', () => {
    const hast = { type: 'element', tagName: 'p', children: [...] };
    const mast = hastToMast(hast);
    expect(mast.topLevel).toHaveLength(1);
    expect(mast.blocks[mast.topLevel[0]].type).toBe('paragraph');
  });
});

// MAST → NoteAtom
describe('mastToNoteAtom', () => {
  it('converts image block', () => {
    const mast = createMastWithImage('uuid-123');
    const noteAtom = mastToNoteAtom(mast);
    expect(noteAtom.content[0].type).toBe('image');
    expect(noteAtom.content[0].attrs.uuid).toBe('uuid-123');
  });
});
```

### dry-run 测试

`--dry-run` 走完流水线但不调用 API：

```typescript
it('dry-run produces correct stats', async () => {
  const result = await processFile('test.md', mockClient, { dryRun: true });
  expect(result.dryRun).toBe(true);
  expect(result.noteId).toBeUndefined();
  expect(result.stats.paragraphs).toBeGreaterThan(0);
});
```

## 扩展到其他平台

### 飞书文档

飞书文档的 BTT 格式比 NoteAtom 复杂，但模式相同：

```
Markdown → HAST → 中间 AST → BTT → 飞书 API
```

关键差异：

| 墨问         | 飞书           |
| ------------ | -------------- |
| 无原生表格   | 支持原生表格   |
| 无原生代码块 | 支持原生代码块 |
| 简单标记     | 复杂标记系统   |

### Notion

Notion API 需要分块创建，流程略有不同：

```
Markdown → HAST → 中间 AST → Notion Blocks → 逐块 API 调用
```

### WordPress

WordPress REST API 支持 Markdown，但可能需要预处理：

```
Markdown → 预处理（图片上传）→ WordPress API
```

## 关键依赖

| 依赖             | 用途                       |
| ---------------- | -------------------------- |
| unified          | AST 处理框架               |
| remark-parse     | Markdown 解析              |
| remark-gfm       | GFM 扩展（表格、任务列表） |
| unist-util-visit | AST 遍历                   |
| playwright       | 表格渲染                   |
| commander        | CLI 框架                   |

## 总结

复刻此模式的核心步骤：

1. **理解目标格式限制** — 确定哪些源格式元素需要适配
2. **设计中间层类型** — 镜像目标格式，保留源元数据
3. **实现转换流水线** — 每个阶段独立实现和测试
4. **处理资源上传** — 两步 OSS 或简化接口
5. **设计 CLI 命令** — 必填参数 + 可选配置 + 调试开关
