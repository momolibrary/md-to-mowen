# md-to-mowen

[![npm version](https://img.shields.io/npm/v/md-to-mowen.svg)](https://www.npmjs.com/package/md-to-mowen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

将 Markdown（GFM）一键发布为墨问笔记的 CLI 工具。

## 功能特性

- **一键发布** — 单文件或整个目录批量发布
- **智能编辑** — 自动追踪文件与笔记映射，再次发布自动进入编辑模式
- **图片处理** — 本地图片/远程 URL 自动上传到墨问 OSS
- **表格渲染** — Markdown 表格自动渲染为高清 PNG 图片
- **双向转换** — 支持 NoteAtom JSON 导出为 Markdown
- **隐私控制** — 独立命令设置笔记公开/私密状态
- **配置持久化** — 保存常用选项，无需每次重复输入

## 快速开始

### 安装

```bash
npm install -g md-to-mowen
```

### 配置 API Key

```bash
md-to-mowen config
```

按提示在微信小程序「墨问」中获取 API Key：个人主页 → 开发者 → 我的 API Key

### 发布笔记

```bash
# 发布单个文件
md-to-mowen publish -i article.md

# 发布整个目录（递归扫描子目录）
md-to-mowen publish -i ./posts

# 添加标签
md-to-mowen publish -i article.md --tags "tech,ai"

# 自动发布（非草稿）
md-to-mowen publish -i article.md --auto-publish
```

发布成功后会显示笔记 ID 和访问地址。再次发布同一文件会自动更新已有笔记。

## CLI 命令

### `publish` — 发布笔记

```bash
md-to-mowen publish -i <path> [options]
```

| 选项                         | 说明                                   |
| ---------------------------- | -------------------------------------- |
| `-i, --input <path>`         | Markdown 文件路径或目录（必填）        |
| `--note-id <id>`             | 编辑已有笔记（全量替换内容）           |
| `--tags <tags>`              | 标签，逗号分隔（如 `tech,ai`）         |
| `--auto-publish`             | 自动发布，非草稿状态                   |
| `--dry-run`                  | 走完流水线但不调用 API                 |
| `--cache-dir <dir>`          | 保存流水线产物用于调试                 |
| `--code-block-style <style>` | 代码块样式：`paragraph` 或 `codeblock` |
| `--no-recursive`             | 批量发布时不递归扫描子目录             |

### `privacy` — 设置隐私状态

```bash
# 通过笔记 ID
md-to-mowen privacy --note-id <id> --visibility public|private

# 通过文件路径（需要元数据支持）
md-to-mowen privacy -i article.md --visibility public
```

### `to-markdown` — NoteAtom 转 Markdown

```bash
md-to-mowen to-markdown -i note.json -o output.md
```

### `config` — 配置 API Key

```bash
md-to-mowen config
```

## 配置文件

在 Markdown 文件同目录下创建 `.md-to-mowen.json` 保存常用选项：

```json
{
  "defaultTags": "tech,programming",
  "autoPublish": false,
  "cacheDir": "./.cache",
  "codeBlockStyle": "paragraph"
}
```

CLI 参数优先级高于配置文件。

## Markdown 支持

| 语法                           | 输出                        |
| ------------------------------ | --------------------------- |
| 标题 H1-H6                     | 粗体段落（层级丢失）        |
| 有序/无序列表                  | 带前缀的段落                |
| 引用块                         | 墨问引用块                  |
| **粗体** / _斜体_ / ~~删除线~~ | 对应标记                    |
| `行内代码`                     | 代码标记                    |
| [链接](url)                    | 链接标记                    |
| 图片                           | 上传后插入                  |
| 代码块                         | 每行带代码标记 / 渲染为图片 |
| 表格                           | 渲染为 PNG 图片             |

## 项目结构

```
md-to-mowen/
├── src/
│   ├── cli/                    # CLI 入口
│   ├── commands/               # 命令实现
│   ├── pipeline/               # Markdown → HAST → MAST
│   ├── mast/                   # 中间 AST 类型与序列化
│   ├── noteatom/               # NoteAtom 类型和双向转换
│   ├── mowen/                  # API 客户端和上传
│   ├── publish/                # 发布流水线编排
│   └── shared/                 # 工具函数
├── tests/                      # 单元测试
└── docs/                       # 学习指南与架构文档
```

## 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 类型检查
npm run check

# 构建
npm run build

# 本地链接
npm link
```

## 相关链接

- [墨问开放 API 文档](https://mowen.apifox.cn/)
- [学习指南与架构文档](docs/README.md)

## License

MIT
