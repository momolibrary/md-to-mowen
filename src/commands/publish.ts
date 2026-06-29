/**
 * 发布命令实现
 *
 * 完整流程（与原仓库 publish_full.sh 一致）：
 * 1. 质量检查（预处理）
 * 2. 封面图处理
 * 3. 表格渲染
 * 3.5. 内嵌图片上传
 * 4. 质量检查（后处理）
 * 5. 转换 NoteAtom
 * 6. 创建笔记
 * 7. 记录日志
 */

import { readFileSync, mkdirSync, existsSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, isAbsolute, resolve } from 'path';
import { homedir } from 'os';
import { lint } from '../core/lint.js';
import { markdownToNoteAtom } from '../core/markdown.js';
import { uploadImage } from '../core/upload.js';
import { MowenAPI } from '../core/api.js';
import { extractTables, renderAllTables, replaceTablesWithMarkers } from '../core/table.js';

export interface PublishOptions {
  cover?: string;
  table?: boolean;
  strict?: boolean;
  apiKey?: string;
}

export interface PublishResult {
  noteId: string;
  url: string;
}

/**
 * 上传内嵌图片（Step 3.5）
 *
 * 检测 markdown 中的 ![alt](/path/to/local/image) 引用
 * 上传本地图片并替换为 TABLE_IMAGE 标记
 */
async function uploadInlineImages(
  mdContent: string,
  baseDir: string,
  apiKey?: string
): Promise<{ content: string; imageCount: number }> {
  // 匹配 ![alt](/path) 格式的本地图片
  const imagePattern = /!\[([^\]]*)\]\((\/[^)]+)\)/g;
  const matches = [...mdContent.matchAll(imagePattern)];

  if (matches.length === 0) {
    return { content: mdContent, imageCount: 0 };
  }

  let result = mdContent;
  let imageIndex = 0;

  // 从后往前替换，避免索引偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const altText = match[1];
    const imagePath = match[2];

    // 解析绝对路径
    const fullPath = isAbsolute(imagePath) ? imagePath : join(baseDir, imagePath);

    if (existsSync(fullPath)) {
      try {
        const uploadResult = await uploadImage(fullPath, { apiKey });
        const marker = `<!-- TABLE_IMAGE_${imageIndex}:${uploadResult.fileId} -->`;
        result =
          result.substring(0, match.index!) +
          marker +
          result.substring(match.index! + match[0].length);
        imageIndex++;
        console.log(`  ✅ Uploaded: ${altText || imagePath} -> ${uploadResult.fileId}`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to upload ${imagePath}:`, error);
      }
    } else {
      console.warn(`  ⚠️  Image not found: ${imagePath}`);
    }
  }

  return { content: result, imageCount: imageIndex };
}

/**
 * 发布文章到墨问
 */
export async function publish(file: string, options: PublishOptions = {}): Promise<PublishResult> {
  let mdContent = readFileSync(file, 'utf-8');
  const baseDir = dirname(file);

  // Step 1: 质量检查（预处理）
  console.log('🔍 Step 1: Quality check (pre-processing)...');
  const lintResult1 = lint(mdContent, {
    hasCover: !!options.cover,
    minChars: 500, // 与原仓库一致
    strict: options.strict,
  });

  if (!lintResult1.passed) {
    console.error('❌ Quality check failed:');
    for (const r of lintResult1.results) {
      if (!r.passed) {
        console.error(`  - ${r.message}: ${r.details}`);
      }
    }
    throw new Error('Quality check failed');
  }
  console.log('✅ Quality check passed');

  // Step 2: 封面图处理
  let coverImageId: string | undefined;
  if (options.cover) {
    console.log('🖼️  Step 2: Uploading cover image...');
    const result = await uploadImage(options.cover, { apiKey: options.apiKey });
    coverImageId = result.fileId;
    console.log(`✅ Cover image uploaded: ${coverImageId}`);
  } else {
    // 尝试从文章中提取第一张图片作为封面
    const firstImageMatch = mdContent.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (firstImageMatch) {
      const imagePath = firstImageMatch[2];
      const fullPath = isAbsolute(imagePath) ? imagePath : join(baseDir, imagePath);
      if (existsSync(fullPath)) {
        console.log('🖼️  Step 2: Using first image as cover...');
        const result = await uploadImage(fullPath, { apiKey: options.apiKey });
        coverImageId = result.fileId;
        console.log(`✅ Cover image uploaded: ${coverImageId}`);
      }
    }
  }

  // Step 3: 表格渲染
  const tableImages: Array<{ index: number; fileId: string }> = [];
  if (options.table !== false) {
    const tables = extractTables(mdContent);
    if (tables.length > 0) {
      console.log(`📊 Step 3: Rendering ${tables.length} tables...`);

      // 创建临时目录
      const tempDir = join(baseDir, '.md-to-mowen-tables');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      try {
        // 渲染表格为图片
        const renderedTables = await renderAllTables(mdContent, tempDir);

        // 上传表格图片
        for (const table of renderedTables) {
          const imagePath = join(tempDir, `table_${table.index}.png`);
          const uploadResult = await uploadImage(imagePath, { apiKey: options.apiKey });
          tableImages.push({
            index: table.index,
            fileId: uploadResult.fileId,
          });
          console.log(`  ✅ Table ${table.index + 1} uploaded: ${uploadResult.fileId}`);
        }

        // 替换表格为标记
        mdContent = replaceTablesWithMarkers(mdContent, renderedTables);
        console.log('✅ Tables rendered and uploaded');
      } finally {
        // 清理临时目录
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  // Step 3.5: 上传内嵌图片
  console.log('🖼️  Step 3.5: Uploading inline images...');
  const { content: processedContent, imageCount } = await uploadInlineImages(
    mdContent,
    baseDir,
    options.apiKey
  );
  mdContent = processedContent;
  if (imageCount > 0) {
    console.log(`✅ Uploaded ${imageCount} inline images`);
  } else {
    console.log('ℹ️  No inline images found');
  }

  // Step 4: 质量检查（后处理）
  console.log('🔍 Step 4: Quality check (post-processing)...');
  const lintResult2 = lint(mdContent, {
    hasCover: !!coverImageId || tableImages.length > 0 || imageCount > 0,
    hasTableImages: tableImages.length > 0,
    minChars: 500,
    strict: true, // 后处理使用严格模式
  });

  if (!lintResult2.passed) {
    console.warn('⚠️  Post-processing quality check warnings:');
    for (const r of lintResult2.results) {
      if (!r.passed) {
        console.warn(`  - ${r.message}: ${r.details}`);
      }
    }
    // 后处理检查失败不阻塞发布，只警告
  } else {
    console.log('✅ Post-processing quality check passed');
  }

  // Step 5: 转换 NoteAtom
  console.log('📝 Step 5: Converting to NoteAtom...');
  const noteAtom = markdownToNoteAtom(mdContent, {
    coverImageId,
    tableImages,
  });
  console.log('✅ Conversion complete');

  // Step 6: 创建笔记
  console.log('📤 Step 6: Creating note...');
  const api = new MowenAPI({ apiKey: options.apiKey });
  const { noteId } = await api.createNote(noteAtom, {
    autoPublish: false,
    tags: ['自动化发布', '质量检查'], // 与原仓库一致
  });

  const url = `https://mowen.cn/note/${noteId}`;
  console.log(`✅ Note created: ${noteId}`);

  // Step 7: 记录日志
  try {
    const logDir = resolve(homedir(), '.claude', 'memory');
    if (existsSync(logDir)) {
      const logFile = join(
        logDir,
        `md-to-mowen_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
      );
      const logContent = `# 墨问发布记录

- **时间**: ${new Date().toISOString()}
- **文件**: ${file}
- **Note ID**: ${noteId}
- **链接**: ${url}
- **封面图**: ${coverImageId || '无'}
- **表格图片**: ${tableImages.length} 张
- **内嵌图片**: ${imageCount} 张

## 质量检查

### 预处理
${lintResult1.results.map((r) => `- ${r.passed ? '✅' : '❌'} ${r.message}`).join('\n')}

### 后处理
${lintResult2.results.map((r) => `- ${r.passed ? '✅' : '❌'} ${r.message}`).join('\n')}
`;
      writeFileSync(logFile, logContent);
      console.log(`📄 发布日志已保存: ${logFile}`);
    }
  } catch (error) {
    // 日志记录失败不阻塞发布
    console.warn('⚠️  保存发布日志失败:', error);
  }

  // Step 8: 输出摘要
  console.log('\n========================================');
  console.log('  发布完成！');
  console.log('========================================');
  console.log(`\n📝 Note ID: ${noteId}`);
  console.log(`🔗 访问链接: ${url}`);
  console.log(`🔒 隐私状态: private`);
  if (coverImageId) console.log(`🖼️  封面图: ${coverImageId}`);
  if (tableImages.length > 0) console.log(`📊 表格图片: ${tableImages.length} 张`);
  if (imageCount > 0) console.log(`🖼️  内嵌图片: ${imageCount} 张`);
  console.log('\n⚠️  笔记当前为草稿状态，需登录墨问平台手动公开\n');

  return { noteId, url };
}
