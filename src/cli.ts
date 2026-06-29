#!/usr/bin/env node

import { Command } from 'commander';
import { VERSION } from './index.js';
import { lint } from './core/lint.js';
import { publish } from './commands/publish.js';
import { readFileSync } from 'fs';

const program = new Command();

program.name('md-to-mowen').description('墨问文章发布 CLI 工具').version(VERSION);

program
  .command('publish <file>')
  .description('发布 Markdown 文章到墨问')
  .option('-c, --cover <image>', '封面图路径')
  .option('--no-table', '跳过表格转换')
  .option('--strict', '严格模式')
  .option('--api-key <key>', '墨问 API Key')
  .action(async (file: string, options: Record<string, unknown>) => {
    try {
      console.log('\n🚀 开始发布文章...\n');
      const result = await publish(file, {
        cover: options.cover as string,
        table: options.table as boolean,
        strict: options.strict as boolean,
        apiKey: options.apiKey as string,
      });
      console.log('\n========================================');
      console.log('  发布完成！');
      console.log('========================================');
      console.log(`\n📝 Note ID: ${result.noteId}`);
      console.log(`🔗 访问链接: ${result.url}`);
      console.log('\n⚠️  笔记当前为草稿状态，需登录墨问平台手动公开\n');
    } catch (error) {
      console.error('\n❌ 发布失败:', error);
      process.exit(1);
    }
  });

program
  .command('lint <file>')
  .description('检查文章质量')
  .option('--strict', '严格模式')
  .option('--min-chars <number>', '最小字数', '100')
  .option('--max-chars <number>', '最大字数', '10000')
  .action((file: string, options: Record<string, unknown>) => {
    try {
      const mdContent = readFileSync(file, 'utf-8');
      const result = lint(mdContent, {
        strict: options.strict as boolean,
        minChars: parseInt(options.minChars as string, 10),
        maxChars: parseInt(options.maxChars as string, 10),
      });

      console.log('\n🔍 质量检查报告\n');
      console.log('='.repeat(50));

      for (const r of result.results) {
        const status = r.passed ? '✅' : '❌';
        console.log(`\n${status} ${r.message}`);
        if (r.details) {
          console.log(`   ${r.details}`);
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log(`\n总计：${result.summary}`);

      if (!result.passed) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('upload <file>')
  .description('上传图片到墨问')
  .option('--api-key <key>', '墨问 API Key')
  .action(async (file: string, options: Record<string, unknown>) => {
    try {
      console.log('\n🖼️  上传图片...\n');
      const { uploadImage } = await import('./core/upload.js');
      const result = await uploadImage(file, {
        apiKey: options.apiKey as string,
      });
      console.log('\n========================================');
      console.log('  上传完成！');
      console.log('========================================');
      console.log(`\n📝 File ID: ${result.fileId}`);
      console.log(`📄 文件名: ${result.fileName}`);
      console.log('');
    } catch (error) {
      console.error('\n❌ 上传失败:', error);
      process.exit(1);
    }
  });

program.parse();
