# 墨问 API 接口详情

> 在线文档：<https://mowen.apifox.cn/>

---

## 笔记创建

> 在线文档：<https://mowen.apifox.cn/295621359e0>

```
POST /api/open/api/v1/note/create
```

### 请求体

```json
{
  "body": <NoteAtomDoc>,
  "settings": {
    "autoPublish": false,
    "tags": ["标签1", "标签2"]
  }
}
```

| 字段                   | 类型        | 必填 | 说明                                    |
| ---------------------- | ----------- | ---- | --------------------------------------- |
| `body`                 | NoteAtomDoc | ✅   | 笔记内容，见 [noteatom.md](noteatom.md) |
| `settings.autoPublish` | boolean     | 否   | 是否自动发布（默认 `false`，创建草稿）  |
| `settings.tags`        | string[]    | 否   | 标签列表                                |

> ⚠️ **重要**：`autoPublish: true` 会**立即公开**笔记。强烈建议保持默认 `false`，创建后再通过「笔记设置」接口控制公开状态。

### 响应体

```json
{
  "noteId": "AwsdqiQ5EQeoVW3pNWeOP"
}
```

| 字段     | 类型   | 说明                        |
| -------- | ------ | --------------------------- |
| `noteId` | string | 笔记 ID，用于后续编辑和设置 |

笔记访问地址：`https://mowen.cn/note/{noteId}`

---

## 笔记编辑

> 在线文档：<https://mowen.apifox.cn/296486093e0>

```
POST /api/open/api/v1/note/edit
```

### 请求体

```json
{
  "noteId": "AwsdqiQ5EQeoVW3pNWeOP",
  "body": <NoteAtomDoc>
}
```

| 字段     | 类型        | 必填 | 说明                         |
| -------- | ----------- | ---- | ---------------------------- |
| `noteId` | string      | ✅   | 要编辑的笔记 ID              |
| `body`   | NoteAtomDoc | ✅   | 新的笔记内容（**全量替换**） |

### 响应体

成功返回空对象 `{}`。

---

## 笔记设置

> 在线文档：<https://mowen.apifox.cn/298137640e0>

```
POST /api/open/api/v1/note/set
```

用于设置笔记的隐私状态等属性。

### 请求体

```json
{
  "noteId": "AwsdqiQ5EQeoVW3pNWeOP",
  "section": 1,
  "settings": {
    "privacy": {
      "type": "private",
      "noShare": false,
      "expireAt": 0
    }
  }
}
```

| 字段                        | 类型    | 必填 | 说明                                                          |
| --------------------------- | ------- | ---- | ------------------------------------------------------------- |
| `noteId`                    | string  | ✅   | 笔记 ID                                                       |
| `section`                   | integer | ✅   | 设置项类型，目前固定为 `1`（隐私设置）                        |
| `settings.privacy.type`     | string  | ✅   | 隐私类型：`public`（公开）/ `private`（私密）/ `rule`（规则） |
| `settings.privacy.noShare`  | boolean | 否   | 是否禁止分享与转发，默认 `false`                              |
| `settings.privacy.expireAt` | integer | 否   | 公开截止时间戳（秒），`0` 表示永久，默认 `0`                  |

### 响应体

成功返回空对象 `{}`。

---

## API-KEY 重置

> 在线文档：<https://mowen.apifox.cn/297614056e0>

```
POST /api/open/api/v1/auth/key/reset
```

重置当前用户的 API Key，旧 Key 立即失效。

### 请求体

空对象 `{}`。

### 响应体

```json
{
  "apiKey": "新的 API Key"
}
```

---

## 获取上传授权信息

> 在线文档：<https://mowen.apifox.cn/304801589e0>

```
POST /api/open/api/v1/upload/prepare
```

本地上传第一步：获取 OSS 直传所需的表单信息。

### 请求体

```json
{
  "fileType": 1,
  "fileName": "image.png"
}
```

| 字段       | 类型    | 必填 | 说明                                  |
| ---------- | ------- | ---- | ------------------------------------- |
| `fileType` | integer | ✅   | 文件类型：`1`=图片，`2`=音频，`3`=PDF |
| `fileName` | string  | 否   | 文件名，不填时系统自动生成            |

### 响应体

```json
{
  "form": {
    "endpoint": "https://oss.example.com/",
    "key": "path/to/file",
    "policy": "...",
    "callback": "...",
    "success_action_status": "200",
    "x-oss-credential": "...",
    "x-oss-date": "...",
    "x-oss-meta-mo-uid": "...",
    "x-oss-signature": "...",
    "x-oss-signature-version": "OSS4-HMAC-SHA256",
    "x:file_id": "abc123-TMP",
    "x:file_name": "image.png",
    "x:file_uid": "uid_xxx"
  }
}
```

- `form.endpoint`：OSS 上传地址（第二步 POST 的目标 URL）
- `form.x:file_id`：文件 ID（即后续 NoteAtom 中的 `uuid`）
- 其余字段需全部作为 multipart/form-data 字段传入第二步

完整上传流程见 [upload-guide.md](upload-guide.md)。

---

## 基于 URL 上传文件

> 在线文档：<https://mowen.apifox.cn/304984752e0>

```
POST /api/open/api/v1/upload/url
```

远程上传：让墨问服务器抓取指定 URL 的文件并上传到 OSS。

### 请求体

```json
{
  "fileType": 1,
  "url": "https://example.com/image.png",
  "fileName": "image.png"
}
```

| 字段       | 类型    | 必填 | 说明                                  |
| ---------- | ------- | ---- | ------------------------------------- |
| `fileType` | integer | ✅   | 文件类型：`1`=图片，`2`=音频，`3`=PDF |
| `url`      | string  | ✅   | 文件的公网 URL                        |
| `fileName` | string  | 否   | 文件名，不填时系统自动生成            |

### 响应体

```json
{
  "uid": "user_uid_xxx",
  "fileId": "abc123-TMP",
  "fileName": "image.png",
  "filePath": "/path/to/file",
  "fileType": 1,
  "fileFormat": "png",
  "fileSize": 102400,
  "fileMime": "image/png",
  "fileHash": "md5hash",
  "fileUrl": "https://cdn.mowen.cn/...",
  "thumbnails": ["https://cdn.mowen.cn/...@100w"],
  "hasRisk": false,
  "extend": {
    "image": {
      "width": 800,
      "height": 600,
      "orientation": 1
    }
  }
}
```

| 字段           | 说明                                         |
| -------------- | -------------------------------------------- |
| `fileId`       | 文件 ID，用作 NoteAtom `image` 节点的 `uuid` |
| `fileUrl`      | 文件访问 URL                                 |
| `thumbnails`   | 缩略图 URL 列表                              |
| `hasRisk`      | 是否有安全风险                               |
| `extend.image` | 图片额外信息（宽/高/拍摄朝向）               |
