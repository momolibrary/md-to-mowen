# 墨问 API 概述

> 在线文档：<https://mowen.apifox.cn/6682121m0>

---

## Base URL

```
https://open.mowen.cn
```

---

## 鉴权

所有接口均使用 **Bearer Token** 鉴权。

```http
Authorization: Bearer <MOWEN_API_KEY>
```

- API Key 在墨问个人设置中获取
- 墨问**不会明文保存**用户的私密凭证，获取后请自行保管
- Key 可通过 `POST /api/open/api/v1/auth/key/reset` 重置

---

## 会员限制

> ⚠️ 目前 API 仅为**墨问会员**提供，会员过期后 API 也会失效。

---

## 频率限制

| 操作     | 限制       |
| -------- | ---------- |
| 创建笔记 | 100 次/天  |
| 编辑笔记 | 1000 次/天 |
| 上传文件 | 200 次/天  |

---

## 请求格式

- 所有接口使用 `POST` 方法（除特别说明）
- 请求体为 `application/json`
- 响应体为 `application/json`

---

## 通用响应结构

成功响应直接返回业务数据（HTTP 200）。

错误响应：

```json
{
  "code": 40001,
  "reason": "错误描述"
}
```

详细错误码见 [error-codes.md](error-codes.md)。

---

## 笔记 URL 格式

```
https://mowen.cn/note/{noteId}
```

---

## API 目录

| 分类             | 接口                 | 路径                                   |
| ---------------- | -------------------- | -------------------------------------- |
| 授权             | API-KEY 重置         | `POST /api/open/api/v1/auth/key/reset` |
| 笔记             | 笔记创建             | `POST /api/open/api/v1/note/create`    |
| 笔记             | 笔记编辑             | `POST /api/open/api/v1/note/edit`      |
| 笔记             | 笔记设置             | `POST /api/open/api/v1/note/set`       |
| 文件上传（本地） | 获取上传授权信息     | `POST /api/open/api/v1/upload/prepare` |
| 文件上传（本地） | 文件投递（OSS 直传） | `POST {form.endpoint}`                 |
| 文件上传（远程） | 基于 URL 上传文件    | `POST /api/open/api/v1/upload/url`     |
