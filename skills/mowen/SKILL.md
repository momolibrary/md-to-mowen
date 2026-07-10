# 墨问发布技能 (Mowen Publish)

将 Markdown 文件发布到墨问笔记平台的完整工作流。

## 触发条件

当用户提到以下关键词时激活：

- 墨问、mowen、发布笔记、发布文章
- markdown 发布、笔记发布

## 快速开始

```bash
# 1. 首次使用：配置 API Key
md-to-mowen config

# 2. 发布单篇文章
md-to-mowen publish -i article.md

# 3. 批量发布目录
md-to-mowen publish -i ./posts
```

## 命令参考

### publish — 发布笔记

```bash
md-to-mowen publish -i <path> [options]
```

| 选项                 | 说明                        |
| -------------------- | --------------------------- |
| `-i, --input <path>` | Markdown 文件或目录（必填） |
| `--note-id <id>`     | 编辑已有笔记（全量替换）    |
| `--tags <tags>`      | 标签，逗号分隔              |
| `--auto-publish`     | 立即发布（非草稿）          |
| `--dry-run`          | 预览模式，不调用 API        |
| `--quiet`            | 静默模式，抑制进度条        |

### status — 查看发布状态

```bash
md-to-mowen status              # 列出所有已发布笔记
md-to-mowen status -i article.md  # 查看单篇状态
md-to-mowen status --json       # JSON 输出
```

### privacy — 设置隐私

```bash
md-to-mowen privacy --note-id <id> --visibility public
md-to-mowen privacy -i article.md --visibility private
```

### config — 配置 API Key

```bash
md-to-mowen config
```

### whoami — 验证登录状态

```bash
md-to-mowen whoami            # 联网校验 API Key 并回显账号信息
md-to-mowen whoami --local    # 跳过联网，仅检查本地配置
md-to-mowen whoami --json     # JSON 输出
```

| 选项      | 说明                                                      |
| --------- | --------------------------------------------------------- |
| `--local` | 跳过联网验证，仅检查本地是否已配置 Key                    |
| `--json`  | 输出 JSON（含 configured / authenticated / profile 字段） |

联网调用 `GET /api/open/api/v1/my/profile`：已登录回显账号名 / UID / 会员状态（exit 0）；Key 失效或未配置 exit 1；联网失败时本地兜底 exit 0。

## 支持的 Markdown 特性

| 特性       | 支持 | 说明                |
| ---------- | ---- | ------------------- |
| 标题 H1-H6 | ✅   | 转为加粗段落        |
| 粗体/斜体  | ✅   | 完整支持            |
| 行内代码   | ✅   | 完整支持            |
| 代码块     | ✅   | 支持语言标识        |
| 链接       | ✅   | 完整支持            |
| 图片       | ✅   | 本地/远程/DataURL   |
| 表格       | ✅   | 渲染为高清图片      |
| 引用       | ✅   | 支持嵌套            |
| 列表       | ✅   | 有序/无序，支持嵌套 |
| 高亮       | ✅   | ==文本== 语法       |
| 音频       | ✅   | ![audio:注释](文件) |
| 内链笔记   | ✅   | ![[note:noteId]]    |
| PDF 嵌入   | ✅   | ![[pdf:文件路径]]   |
| 删除线     | ✅   | ~~文本~~ 语法       |
| 分隔线     | ✅   | --- 语法            |

## 配置文件

在项目目录创建 `.md-to-mowen/config.json`：

```json
{
  "defaultTags": "tech,ai",
  "autoPublish": false,
  "cacheDir": "out/pipeline-cache"
}
```

## 环境变量

| 变量                 | 说明         |
| -------------------- | ------------ |
| `MOWEN_API_KEY`      | 墨问 API Key |
| `MOWEN_DEFAULT_TAGS` | 默认标签     |
| `MOWEN_AUTO_PUBLISH` | 自动发布     |

## 典型工作流

### 发布新文章

```bash
# 写完文章后
md-to-mowen publish -i my-article.md --tags "tech,ai"
# → 创建草稿，返回笔记链接
```

### 更新已发布文章

```bash
# 修改文章后重新发布（自动检测已发布笔记）
md-to-mowen publish -i my-article.md
# → 自动进入编辑模式，全量替换内容
```

### 批量发布

```bash
# 发布整个目录
md-to-mowen publish -i ./blog-posts --auto-publish
# → 逐个发布，显示进度条和 ETA
```

### 预览转换结果

```bash
# 不调用 API，仅查看转换结果
md-to-mowen publish -i article.md --dry-run
# → 显示流水线统计和 NoteAtom 预览
```
