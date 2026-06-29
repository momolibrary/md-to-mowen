import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, existsSync } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadConfig,
  getConfigPaths,
  DEFAULT_CONFIG,
  type ResolvedConfig,
} from '../../src/shared/config.js';

let testDir: string;
let originalEnv: Record<string, string | undefined>;

beforeEach(async () => {
  testDir = join(tmpdir(), `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });

  // 保存原始环境变量
  originalEnv = {
    MOWEN_DEFAULT_TAGS: process.env.MOWEN_DEFAULT_TAGS,
    MOWEN_AUTO_PUBLISH: process.env.MOWEN_AUTO_PUBLISH,
    MOWEN_CACHE_DIR: process.env.MOWEN_CACHE_DIR,
  };

  // 清除环境变量
  delete process.env.MOWEN_DEFAULT_TAGS;
  delete process.env.MOWEN_AUTO_PUBLISH;
  delete process.env.MOWEN_CACHE_DIR;
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });

  // 恢复原始环境变量
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

// ── loadConfig 默认值 ───────────────────────────────────────────────────────────

describe('loadConfig 默认值', () => {
  it('配置文件不存在时返回默认值', () => {
    const config = loadConfig({}, testDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('空配置对象返回默认值', () => {
    const config = loadConfig({}, testDir);
    expect(config.defaultTags).toBe('');
    expect(config.autoPublish).toBe(false);
    expect(config.cacheDir).toBe('out/pipeline-cache');
  });
});

// ── 配置文件加载 ───────────────────────────────────────────────────────────────

describe('项目级配置文件', () => {
  it('正确读取项目级配置', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'tech,ai',
        autoPublish: true,
        cacheDir: 'custom-cache',
      }),
      'utf8'
    );

    const config = loadConfig({}, projectDir);
    expect(config.defaultTags).toBe('tech,ai');
    expect(config.autoPublish).toBe(true);
    expect(config.cacheDir).toBe('custom-cache');
  });

  it('项目级配置优先于用户级配置', async () => {
    const projectDir = join(testDir, 'project');
    const userDir = join(testDir, 'user');

    // 模拟用户级配置
    await mkdir(join(userDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(userDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'user-tags',
        autoPublish: false,
      }),
      'utf8'
    );

    // 项目级配置
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'project-tags',
        autoPublish: true,
      }),
      'utf8'
    );

    // 由于 getConfigPaths 使用 homedir()，我们无法直接模拟用户目录
    // 这里仅验证项目级配置被正确加载
    const config = loadConfig({}, projectDir);
    expect(config.defaultTags).toBe('project-tags');
    expect(config.autoPublish).toBe(true);
  });

  it('JSON 格式错误时警告并使用默认值', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(join(projectDir, '.md-to-mowen', 'config.json'), '{ broken json!!!', 'utf8');

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    const config = loadConfig({}, projectDir);
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnings.some((w) => w.includes('JSON 解析失败'))).toBe(true);

    console.warn = originalWarn;
  });

  it('未知字段被忽略', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'test',
        unknownField: 'shouldBeIgnored',
        anotherUnknown: 123,
      }),
      'utf8'
    );

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    const config = loadConfig({}, projectDir);
    expect(config.defaultTags).toBe('test');
    expect(warnings.some((w) => w.includes('忽略未知字段'))).toBe(true);

    console.warn = originalWarn;
  });
});

// ── CLI 参数覆盖 ────────────────────────────────────────────────────────────────

describe('CLI 参数覆盖', () => {
  it('CLI --tags 覆盖 defaultTags', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({ defaultTags: 'config-tags' }),
      'utf8'
    );

    const config = loadConfig({ defaultTags: 'cli-tags' }, projectDir);
    expect(config.defaultTags).toBe('cli-tags');
  });

  it('CLI --auto-publish 覆盖配置文件 autoPublish', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({ autoPublish: false }),
      'utf8'
    );

    const config = loadConfig({ autoPublish: true }, projectDir);
    expect(config.autoPublish).toBe(true);
  });
});

// ── 环境变量配置 ────────────────────────────────────────────────────────────────

describe('环境变量配置', () => {
  it('MOWEN_DEFAULT_TAGS 正确应用', () => {
    process.env.MOWEN_DEFAULT_TAGS = 'env-tags';
    const config = loadConfig({}, testDir);
    expect(config.defaultTags).toBe('env-tags');
  });

  it('MOWEN_AUTO_PUBLISH=true 正确应用', () => {
    process.env.MOWEN_AUTO_PUBLISH = 'true';
    const config = loadConfig({}, testDir);
    expect(config.autoPublish).toBe(true);
  });

  it('MOWEN_AUTO_PUBLISH=1 正确应用', () => {
    process.env.MOWEN_AUTO_PUBLISH = '1';
    const config = loadConfig({}, testDir);
    expect(config.autoPublish).toBe(true);
  });

  it('MOWEN_AUTO_PUBLISH=false 不启用', () => {
    process.env.MOWEN_AUTO_PUBLISH = 'false';
    const config = loadConfig({}, testDir);
    expect(config.autoPublish).toBe(false);
  });

  it('MOWEN_CACHE_DIR 正确应用', () => {
    process.env.MOWEN_CACHE_DIR = 'env-cache';
    const config = loadConfig({}, testDir);
    expect(config.cacheDir).toBe('env-cache');
  });

  it('环境变量优先于配置文件', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'config-tags',
        autoPublish: false,
      }),
      'utf8'
    );

    process.env.MOWEN_DEFAULT_TAGS = 'env-tags';
    process.env.MOWEN_AUTO_PUBLISH = 'true';

    const config = loadConfig({}, projectDir);
    expect(config.defaultTags).toBe('env-tags');
    expect(config.autoPublish).toBe(true);
  });
});

// ── 配置优先级链 ────────────────────────────────────────────────────────────────

describe('配置优先级链', () => {
  it('完整优先级链：CLI > env > 项目 > 默认', async () => {
    const projectDir = join(testDir, 'project');
    await mkdir(join(projectDir, '.md-to-mowen'), { recursive: true });
    await writeFile(
      join(projectDir, '.md-to-mowen', 'config.json'),
      JSON.stringify({
        defaultTags: 'project-tags',
        autoPublish: false,
      }),
      'utf8'
    );

    process.env.MOWEN_DEFAULT_TAGS = 'env-tags';
    process.env.MOWEN_AUTO_PUBLISH = 'true';

    // CLI 最高优先级
    const config = loadConfig(
      {
        defaultTags: 'cli-tags',
        autoPublish: false, // CLI 覆盖 env
      },
      projectDir
    );

    expect(config.defaultTags).toBe('cli-tags');
    expect(config.autoPublish).toBe(false); // CLI 覆盖 env 的 true
  });
});

// ── getConfigPaths ───────────────────────────────────────────────────────────────

describe('getConfigPaths', () => {
  it('返回正确的项目级和用户级路径', () => {
    const paths = getConfigPaths('/custom/project');
    expect(paths.project).toBe('/custom/project/.md-to-mowen/config.json');
    expect(paths.user).toContain('.md-to-mowen/config.json');
  });

  it('默认使用 cwd', () => {
    const paths = getConfigPaths();
    expect(paths.project).toContain('.md-to-mowen/config.json');
  });
});
