# 墨问 API 文档索引

> 在线文档：**<https://mowen.apifox.cn/>**
>
> 本目录是离线快照，供 Agent 在无网络或需要快速引用时使用。
> 若在线文档与本地文档有出入，**以在线文档为准**。

---

## 目录

| 文件                               | 内容                                            |
| ---------------------------------- | ----------------------------------------------- |
| [overview.md](overview.md)         | 概述：Base URL、鉴权、频率限制、会员限制        |
| [noteatom.md](noteatom.md)         | NoteAtom 文档格式完整说明（节点类型、字段定义） |
| [endpoints.md](endpoints.md)       | 所有接口：请求/响应结构、字段说明、示例         |
| [error-codes.md](error-codes.md)   | 错误码列表                                      |
| [upload-guide.md](upload-guide.md) | 文件上传完整流程（本地两步 OSS + 远程 URL）     |

---

## 快速导航

### 鉴权

见 [overview.md#鉴权](overview.md#鉴权)

### 发布笔记流程

1. （有图片/表格时）上传文件 → 获得 `fileId` → 见 [upload-guide.md](upload-guide.md)
2. 构造 NoteAtom 文档 → 见 [noteatom.md](noteatom.md)
3. 调用笔记创建/编辑接口 → 见 [endpoints.md#笔记创建](endpoints.md#笔记创建)
4. （可选）设置隐私 → 见 [endpoints.md#笔记设置](endpoints.md#笔记设置)
