# 文件上传完整流程

> 在线文档：<https://mowen.apifox.cn/304801589e0>（本地上传）、<https://mowen.apifox.cn/304984752e0>（远程上传）

---

## 两种上传方式

| 方式                  | 适用场景            | 接口                        |
| --------------------- | ------------------- | --------------------------- |
| **本地两步 OSS 上传** | 本地文件、Data URI  | `upload/prepare` → OSS 直传 |
| **远程 URL 上传**     | 已有公网 URL 的图片 | `upload/url`（一步完成）    |

---

## 方式一：本地两步 OSS 上传

### 步骤 1 — 获取上传凭证

```http
POST /api/open/api/v1/upload/prepare
Authorization: Bearer <MOWEN_API_KEY>
Content-Type: application/json

{
  "fileType": 1,
  "fileName": "image.png"
}
```

响应：

```json
{
  "form": {
    "endpoint": "https://oss-endpoint.aliyuncs.com/",
    "key": "mo/uid/2024/01/abc123",
    "policy": "eyJleHBpcmF0aW9uIjoiMjAyNC...",
    "callback": "eyJ...",
    "success_action_status": "200",
    "x-oss-credential": "LTAIxxxx/20240101/cn-shanghai/oss/aliyun_v4_request",
    "x-oss-date": "20240101T000000Z",
    "x-oss-meta-mo-uid": "uid_xxx",
    "x-oss-signature": "...",
    "x-oss-signature-version": "OSS4-HMAC-SHA256",
    "x:file_id": "abc123-TMP",
    "x:file_name": "image.png",
    "x:file_uid": "uid_xxx"
  }
}
```

记录 `form.x:file_id` — 这就是后续 NoteAtom 中使用的 `uuid`。

### 步骤 2 — OSS 直传

向 `form.endpoint` 发送 multipart/form-data 请求，包含 `form` 中所有字段：

```http
POST {form.endpoint}
Content-Type: multipart/form-data

key                    = {form.key}
policy                 = {form.policy}
callback               = {form.callback}
success_action_status  = {form.success_action_status}
x-oss-credential       = {form["x-oss-credential"]}
x-oss-date             = {form["x-oss-date"]}
x-oss-meta-mo-uid      = {form["x-oss-meta-mo-uid"]}
x-oss-signature        = {form["x-oss-signature"]}
x-oss-signature-version = {form["x-oss-signature-version"]}
x:file_id              = {form["x:file_id"]}
x:file_name            = {form["x:file_name"]}
x:file_uid             = {form["x:file_uid"]}
file                   = <二进制文件内容>
```

响应（HTTP 200）：

```json
{
  "fileId": "abc123-TMP",
  "fileName": "image.png"
}
```

### 步骤 3 — 使用 fileId

在 NoteAtom 的 `image` 节点中使用 `fileId` 作为 `uuid`：

```json
{
  "type": "image",
  "attrs": {
    "uuid": "abc123-TMP",
    "alt": "图片描述",
    "align": "center"
  }
}
```

---

## 方式二：远程 URL 上传（更简单）

适用于图片 URL 可公网访问的场景（如网络图片）。

```http
POST /api/open/api/v1/upload/url
Authorization: Bearer <MOWEN_API_KEY>
Content-Type: application/json

{
  "fileType": 1,
  "url": "https://example.com/image.png",
  "fileName": "image.png"
}
```

响应中直接获得 `fileId`：

```json
{
  "fileId": "abc123-TMP",
  "fileUrl": "https://cdn.mowen.cn/...",
  ...
}
```

---

## TypeScript 伪代码参考

```typescript
// 本地文件上传
async function uploadLocalFile(filePath: string, apiKey: string): Promise<string> {
  const fileName = path.basename(filePath);

  // Step 1: 获取凭证
  const prepareRes = await fetch('https://open.mowen.cn/api/open/api/v1/upload/prepare', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileType: 1, fileName }),
  });
  const { form } = await prepareRes.json();

  // Step 2: OSS 直传
  const formData = new FormData();
  for (const [key, value] of Object.entries(form)) {
    if (key !== 'endpoint') {
      formData.append(key, value as string);
    }
  }
  formData.append('file', new Blob([await fs.readFile(filePath)]));

  await fetch(form.endpoint, { method: 'POST', body: formData });

  // Step 3: 返回 fileId
  return form['x:file_id'];
}

// 远程 URL 上传
async function uploadRemoteUrl(url: string, apiKey: string): Promise<string> {
  const res = await fetch('https://open.mowen.cn/api/open/api/v1/upload/url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileType: 1, url }),
  });
  const { fileId } = await res.json();
  return fileId;
}
```
