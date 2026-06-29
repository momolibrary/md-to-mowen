# md-to-mowen

将 Markdown（GFM）一键发布为墨问笔记的 CLI 工具。

![image-20260514130051810](./images/readme_header.png)

## 安装

```bash
npm install -g md-to-mowen
```

或使用 npx：

```bash
npx md-to-mowen --version
```

## 使用

### 发布文章

```bash
# 基本发布
md-to-mowen publish article.md

# 指定封面图
md-to-mowen publish article.md --cover cover.png

# 严格模式
md-to-mowen publish article.md --strict

# 跳过表格转换
md-to-mowen publish article.md --no-table
```

### 检查文章质量

```bash
# 基本检查
md-to-mowen lint article.md

# 严格模式
md-to-mowen lint article.md --strict

# 自定义字数范围
md-to-mowen lint article.md --min-chars 200 --max-chars 5000
```

### 上传图片

```bash
md-to-mowen upload image.png
```

## 配置

### API Key

设置环境变量：

```bash
export MOWEN_API_KEY=your-api-key
```

或在命令中指定：

```bash
md-to-mowen publish article.md --api-key your-api-key
```

## 质量检查项

1. **配图检查** - 必须有封面图或内嵌图片
2. **表格检查** - 有表格必须已转换为图片
3. **标题层级** - H1→H2→H3，不能跳级
4. **文章长度** - 建议 100-10000 字
5. **特殊标记** - 无 TODO/FIXME 等占位符

## 开发

```bash
# 克隆仓库
git clone https://github.com/momolibrary/md-to-mowen.git
cd md-to-mowen

# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test

# 代码检查
npm run lint
```

## 项目结构

```
md-to-mowen/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 核心导出
│   ├── commands/
│   │   └── publish.ts      # 发布命令
│   └── core/
│       ├── api.ts          # 墨问 API
│       ├── auth.ts         # 授权管理
│       ├── extract-prompt.ts # 提示词提取
│       ├── lint.ts         # 质量检查
│       ├── markdown.ts     # Markdown 转换
│       ├── table.ts        # 表格处理
│       └── upload.ts       # 图片上传
├── tests/
│   ├── fixtures/           # 测试种子
│   ├── unit/               # 单元测试
│   └── integration/        # 集成测试
└── skill/
    ├── SKILL.md            # Claude Code Skill
    └── publish.sh          # Skill wrapper
```

## License

MIT

# md-to-mowen
