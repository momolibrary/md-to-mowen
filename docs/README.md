# md-to-mowen 文档中心

本目录包含项目的完整文档，分为两个部分：

## 学习指南

面向不同需求的用户：

| 目标     | 文档                                               | 说明                                  |
| -------- | -------------------------------------------------- | ------------------------------------- |
| 快速使用 | [guides/quick-start.md](guides/quick-start.md)     | 最简安装、使用示例、给 AI 的 Prompt   |
| 理解原理 | [guides/understanding.md](guides/understanding.md) | 流水线架构、MAST 中间层、关键设计决策 |
| 复刻模式 | [guides/replication.md](guides/replication.md)     | 如何将此模式应用到其他笔记平台        |

## 架构文档

面向实现细节的研究：

| 文档                                               | 说明                                      |
| -------------------------------------------------- | ----------------------------------------- |
| [architecture/CONCEPT.md](architecture/CONCEPT.md) | 完整架构设计、NoteAtom 类型系统、API 集成 |
| [architecture/api/](architecture/api/)             | 墨问 API 文档（接口、上传流程、错误码）   |

---

## 快速导航

### 我是普通用户

→ 直接看 [快速使用指南](guides/quick-start.md)，包含可直接复制给 AI 的 Prompt。

### 我是开发者，想理解这个项目

→ 先看 [理解仓库原理](guides/understanding.md)，了解流水线架构和关键设计。

→ 再看 [概念与架构](architecture/CONCEPT.md)，深入每个阶段的细节。

### 我想把这个模式用到其他平台

→ 看 [复刻核心模式](guides/replication.md)，了解如何设计 AST 中间层和流水线。

---

## 文档结构

```
docs/
├── README.md              # 本文档（入口）
├── guides/                # 学习指南
│   ├── quick-start.md     # 快速使用指南
│   ├── understanding.md   # 理解仓库原理
│   └── replication.md     # 复刻核心模式
└── architecture/          # 架构文档
    ├── CONCEPT.md         # 完整架构设计
    └── api/               # 墨问 API 文档
        ├── README.md
        ├── endpoints.md
        ├── noteatom.md
        └── upload-guide.md
```
