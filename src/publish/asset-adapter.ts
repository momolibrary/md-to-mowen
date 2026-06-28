import type { MASTDocument, MASTImageBlock, MASTAudioBlock, MASTPdfBlock } from '../mast/types.js';
import type { MowenClient } from '../mowen/client.js';
import { uploadLocalFile, uploadRemoteUrl, uploadDataUri } from '../mowen/upload.js';
import { renderTableToPng } from './table-renderer.js';
import { withRetry } from '../shared/retry.js';
import { extname } from 'path';

const MIME_MAP: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  pdf: 'application/pdf',
};

function mimeFromExt(fileName: string): string {
  const ext = extname(fileName).slice(1).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

export interface AssetAdapterOptions {
  /** 相对路径图片的基准目录（通常为 Markdown 文件所在目录） */
  baseDir?: string;
  /** dry-run 模式：跳过实际上传，uuid 填入占位符 */
  dryRun?: boolean;
}

/**
 * 遍历 MAST，将所有 MASTImageBlock 的资源上传到墨问 OSS，
 * 并将返回的 fileId 写入 block.uuid。
 *
 * 表格（isTable: true）先用 Playwright 渲染为 PNG，再上传。
 */
export async function processAssets(
  doc: MASTDocument,
  client: MowenClient,
  opts: AssetAdapterOptions = {},
): Promise<void> {
  const { baseDir = process.cwd(), dryRun = false } = opts;

  const imageBlocks = Object.values(doc.blocks).filter((b): b is MASTImageBlock => b.type === 'image');
  const audioBlocks = Object.values(doc.blocks).filter((b): b is MASTAudioBlock => b.type === 'audio');
  const pdfBlocks = Object.values(doc.blocks).filter((b): b is MASTPdfBlock => b.type === 'pdf' && !b.uuid);

  // 串行上传，每次间隔 1.1s
  await concurrentMap([...imageBlocks, ...audioBlocks, ...pdfBlocks], 3, async (block) => {
    if (dryRun) {
      block.uuid = `dry-run-${block.id}`;
      return;
    }

    if (block.type === 'audio') {
      block.uuid = await uploadAudioBlock(block, client, baseDir);
    } else if (block.type === 'pdf') {
      block.uuid = await uploadPdfBlock(block, client, baseDir);
    } else {
      block.uuid = await uploadBlock(block, client, baseDir);
    }
  });
}

async function uploadPdfBlock(block: MASTPdfBlock, client: MowenClient, baseDir: string): Promise<string> {
  const src = block.src;

  // 远程 URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return client.uploadViaUrl(3, src);
  }

  // 本地路径
  const { readFile } = await import('fs/promises');
  const { resolve, isAbsolute, basename } = await import('path');
  const decodedSrc = decodeURIComponent(src);
  const absPath = isAbsolute(decodedSrc) ? decodedSrc : resolve(baseDir, decodedSrc);
  const fileName = basename(absPath);
  const fileBuffer = await readFile(absPath);
  const form = await client.uploadPrepare(3, fileName);

  await withRetry(async () => {
    const formData = new FormData();
    const fields = [
      'key',
      'policy',
      'callback',
      'success_action_status',
      'x-oss-credential',
      'x-oss-date',
      'x-oss-meta-mo-uid',
      'x-oss-signature',
      'x-oss-signature-version',
      'x:file_id',
      'x:file_name',
      'x:file_uid',
    ] as const;
    for (const field of fields) {
      formData.append(field, (form as unknown as Record<string, string>)[field]);
    }
    formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), fileName);
    const res = await fetch(form.endpoint, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`OSS upload failed: ${res.status}`);
  });

  return form['x:file_id'];
}

async function uploadAudioBlock(block: MASTAudioBlock, client: MowenClient, baseDir: string): Promise<string> {
  const src = block.src;

  // 远程 URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return client.uploadViaUrl(2, src);
  }

  // 本地路径；remark-rehype 会对中文路径做 URL 编码，需先解码
  const { readFile } = await import('fs/promises');
  const { resolve, isAbsolute, basename } = await import('path');
  const decodedSrc = decodeURIComponent(src);
  const absPath = isAbsolute(decodedSrc) ? decodedSrc : resolve(baseDir, decodedSrc);
  const fileName = basename(absPath);
  const fileBuffer = await readFile(absPath);
  const form = await client.uploadPrepare(2, fileName);

  await withRetry(async () => {
    const formData = new FormData();
    const fields = [
      'key',
      'policy',
      'callback',
      'success_action_status',
      'x-oss-credential',
      'x-oss-date',
      'x-oss-meta-mo-uid',
      'x-oss-signature',
      'x-oss-signature-version',
      'x:file_id',
      'x:file_name',
      'x:file_uid',
    ] as const;
    for (const field of fields) {
      formData.append(field, (form as unknown as Record<string, string>)[field]);
    }
    formData.append('file', new Blob([fileBuffer], { type: mimeFromExt(fileName) }), fileName);
    const res = await fetch(form.endpoint, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`OSS upload failed: ${res.status}`);
  });

  return form['x:file_id'];
}

async function uploadBlock(block: MASTImageBlock, client: MowenClient, baseDir: string): Promise<string> {
  // 表格：先渲染为 PNG，再上传
  if (block.isTable) {
    const pngBuffer = await renderTableToPng(block.src);
    return uploadPngBuffer(pngBuffer, client);
  }

  const src = block.src;

  // Data URI
  if (src.startsWith('data:')) {
    return uploadDataUri(src, client);
  }

  // 远程 URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return uploadRemoteUrl(src, client);
  }

  // 本地路径（绝对或相对）；remark-rehype 会对中文路径做 URL 编码，需先解码
  const { resolve, isAbsolute } = await import('path');
  const decodedSrc = decodeURIComponent(src);
  const absPath = isAbsolute(decodedSrc) ? decodedSrc : resolve(baseDir, decodedSrc);
  return uploadLocalFile(absPath, client);
}

/**
 * 上传内存中的 PNG Buffer（表格渲染结果）。
 * 通过 prepare → OSS 两步上传。
 */
async function uploadPngBuffer(buffer: Buffer, client: MowenClient): Promise<string> {
  const fileName = `table-${Date.now()}.png`;
  const form = await client.uploadPrepare(1, fileName);

  await withRetry(async () => {
    const formData = new FormData();
    const fields = [
      'key',
      'policy',
      'callback',
      'success_action_status',
      'x-oss-credential',
      'x-oss-date',
      'x-oss-meta-mo-uid',
      'x-oss-signature',
      'x-oss-signature-version',
      'x:file_id',
      'x:file_name',
      'x:file_uid',
    ] as const;

    for (const field of fields) {
      formData.append(field, (form as unknown as Record<string, string>)[field]);
    }
    formData.append('file', new Blob([buffer], { type: 'image/png' }), fileName);

    const res = await fetch(form.endpoint, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`OSS upload failed: ${res.status}`);
  });

  return form['x:file_id'];
}

/**
 * 串行上传，每次上传后等待 1.1s 以遵守墨问 API 1次/秒 的限频要求。
 * 原并发方案在 10 个资源时会触发 429，改为串行+间隔。
 */
async function concurrentMap<T>(items: T[], _concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item !== undefined) {
      await fn(item);
      if (i < items.length - 1) {
        await sleep(1100);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
