# 快速使用指南

> 本文档帮助用户快速上手 md-to-mowen，包含可直接复制给 AI 的 Prompt。

## 给 AI 的 Prompt

将以下内容复制给你的 AI（Claude、ChatGPT 等），AI 将理解并学会使用此工具：

---

````
我需要你帮我使用 md-to-mowen 这个工具，将 Markdown 文件发布为墨问笔记。

## 工具介绍

md-to-mowen 是一个 npm 包，可以将 Markdown（GFM）一键发布到墨问笔记平台。它支持：
- 图片自动上传到墨问 OSS
- 表格渲染为高清 PNG 图片
- 智能编辑：再次发布同一文件自动更新已有笔记
- 标签、草稿/发布状态控制

## 安装

```bash
npm install -g md-to-mowen
````

## 配置 API Key

1. 在微信小程序「墨问」中获取 API Key：个人主页 → 开发者 → 我的 API Key
2. 运行配置命令：

```bash
md-to-mowen config
```

按提示输入 API Key。

## 使用

### 发布单个文件

```bash
md-to-mowen publish -i article.md
```

### 发布整个目录

```bash
md-to-mowen publish -i ./posts
```

### 常用选项

```bash
# 添加标签
md-to-mowen publish -i article.md --tags "tech,ai"

# 自动发布（非草稿）
md-to-mowen publish -i article.md --auto-publish

# 验证但不发布（dry-run）
md-to-mowen publish -i article.md --dry-run
```

## 注意事项

1. 首次发布会创建新笔记，再次发布同一文件会自动更新
2. 本地图片会自动上传，远程图片 URL 也会自动处理
3. Markdown 表格会渲染为图片插入
4. 默认创建草稿，需在墨问小程序手动发布

请帮我执行上述步骤，发布我指定的 Markdown 文件。

````

---

## 最简安装

```bash
npm install -g md-to-mowen
````

## 配置 API Key

### 步骤 1：获取 API Key

在微信小程序「墨问」中：

- 个人主页 → 开发者 → 我的 API Key
- 复制 API Key

### 步骤 2：配置工具

```bash
md-to-mowen config
```

按提示输入 API Key，配置会保存到 `~/.md-to-mowen/.env`。

## 基本使用

### 发布单个文件

```bash
md-to-mowen publish -i article.md
```

输出：

```
✅ 发布成功
笔记 ID: AwsdqiQ5EQeoVW3pNWeOP
访问地址: https://mowen.cn/note/AwsdqiQ5EQeoVW3pNWeOP
```

### 发布目录

```bash
md-to-mowen publish -i ./posts
```

递归扫描目录下所有 `.md` 文件并批量发布。

### 更新已有笔记

再次发布同一文件会自动检测并更新：

```bash
md-to-mowen publish -i article.md
# 检测到已有笔记，进入编辑模式
```

### 验证但不发布

```bash
md-to-mowen publish -i article.md --dry-run
```

输出流水线统计和 NoteAtom 预览，不调用 API。

## 常用选项

| 选项                           | 说明                   |
| ------------------------------ | ---------------------- |
| `--tags "tag1,tag2"`           | 添加标签               |
| `--auto-publish`               | 自动发布（非草稿）     |
| `--dry-run`                    | 验证但不发布           |
| `--no-recursive`               | 批量时不递归子目录     |
| `--code-block-style codeblock` | 代码块使用墨问原生格式 |

## 配置文件

在 Markdown 文件目录创建 `.md-to-mowen.json`：

```json
{
  "defaultTags": "tech,programming",
  "autoPublish": false,
  "codeBlockStyle": "paragraph"
}
```

CLI 参数优先级高于配置文件。

## 常见问题

### Q: 图片显示不出来？

检查图片路径是否正确：

- 本地图片：使用相对路径（相对于 Markdown 文件）
- 远程图片：确保 URL 可访问

### Q: 表格显示异常？

表格会渲染为 PNG 图片。如果渲染失败，检查表格语法是否正确的 GFM 格式。

### Q: 如何查看已发布的笔记？

在墨问小程序「我的」页面查看所有笔记。

### Q: 如何删除笔记？

当前工具不支持删除，需在墨问小程序中手动删除。

### Q: 支持哪些 Markdown 语法？

| 语法             | 支持                |
| ---------------- | ------------------- |
| 标题 H1-H6       | ✓（转为粗体段落）   |
| 粗体/斜体/删除线 | ✓                   |
| 行内代码         | ✓                   |
| 链接             | ✓                   |
| 图片             | ✓（自动上传）       |
| 代码块           | ✓（可配置样式）     |
| 表格             | ✓（渲染为图片）     |
| 引用块           | ✓                   |
| 列表             | ✓（转为带前缀段落） |

### Q: API Key 如何安全存储？

API Key 存储在 `~/.md-to-mowen/.env`，不会暴露到 Git。如果多人共用机器，建议使用环境变量：

```bash
export MOWEN_API_KEY=your_key_here
md-to-mowen publish -i article.md
```

## 下一步

- 深入理解项目架构？见 [understanding.md](understanding.md)
- 复刻此模式到其他平台？见 [replication.md](replication.md)
