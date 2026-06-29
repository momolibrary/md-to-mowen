import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── 配置类型定义 ───────────────────────────────────────────────────────────────

export interface MdToMowenConfig {
  /** 默认标签，逗号分隔 */
  defaultTags?: string;
  /** 是否默认自动发布 */
  autoPublish?: boolean;
  /** 缓存目录路径 */
  cacheDir?: string;
}

export interface ResolvedConfig {
  defaultTags: string;
  autoPublish: boolean;
  cacheDir: string;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  defaultTags: '',
  autoPublish: false,
  cacheDir: 'out/pipeline-cache',
};

// ── 环境变量映射 ───────────────────────────────────────────────────────────────

function readEnvConfig(): Partial<MdToMowenConfig> {
  const config: Partial<MdToMowenConfig> = {};

  const tags = process.env.MOWEN_DEFAULT_TAGS;
  if (tags !== undefined) {
    config.defaultTags = tags;
  }

  const autoPublish = process.env.MOWEN_AUTO_PUBLISH;
  if (autoPublish !== undefined) {
    config.autoPublish = autoPublish === 'true' || autoPublish === '1';
  }

  const cacheDir = process.env.MOWEN_CACHE_DIR;
  if (cacheDir !== undefined) {
    config.cacheDir = cacheDir;
  }

  return config;
}

// ── 配置文件加载 ───────────────────────────────────────────────────────────────

interface ConfigFileResult {
  config: Partial<MdToMowenConfig>;
  source: string;
}

function loadConfigFile(path: string, label: string): ConfigFileResult | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);

    // 验证并过滤已知字段
    const validConfig: Partial<MdToMowenConfig> = {};

    if ('defaultTags' in parsed && typeof parsed.defaultTags === 'string') {
      validConfig.defaultTags = parsed.defaultTags;
    }

    if ('autoPublish' in parsed && typeof parsed.autoPublish === 'boolean') {
      validConfig.autoPublish = parsed.autoPublish;
    }

    if ('cacheDir' in parsed && typeof parsed.cacheDir === 'string') {
      validConfig.cacheDir = parsed.cacheDir;
    }

    // 未知字段忽略（向前兼容）
    const knownKeys = ['defaultTags', 'autoPublish', 'cacheDir'];
    const unknownKeys = Object.keys(parsed).filter((k) => !knownKeys.includes(k));
    if (unknownKeys.length > 0) {
      console.warn(`[config] ${label}: 忽略未知字段 ${unknownKeys.join(', ')}`);
    }

    return { config: validConfig, source: label };
  } catch (err) {
    console.warn(`[config] ${label}: JSON 解析失败，使用默认值`);
    console.warn(`         错误：${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── 配置路径查找 ───────────────────────────────────────────────────────────────

export function getConfigPaths(projectRoot?: string): { project: string; user: string } {
  const cwd = projectRoot ?? process.cwd();
  return {
    project: join(cwd, '.md-to-mowen', 'config.json'),
    user: join(homedir(), '.md-to-mowen', 'config.json'),
  };
}

// ── 主入口：合并配置 ───────────────────────────────────────────────────────────

/**
 * 按优先级合并配置：CLI > env > 项目 > 用户 > 默认
 *
 * @param cliOverrides CLI 参数覆盖（最高优先级）
 * @param projectRoot 项目根目录（用于查找项目级配置）
 */
export function loadConfig(
  cliOverrides: Partial<MdToMowenConfig> = {},
  projectRoot?: string
): ResolvedConfig {
  const paths = getConfigPaths(projectRoot);

  // 1. 用户级配置（最低优先级）
  const userResult = loadConfigFile(paths.user, '用户级配置');

  // 2. 项目级配置（优先于用户级）
  const projectResult = loadConfigFile(paths.project, '项目级配置');

  // 3. 环境变量配置（优先于配置文件）
  const envConfig = readEnvConfig();

  // 4. 合并（从低到高优先级）
  const merged: Partial<MdToMowenConfig> = {
    ...userResult?.config,
    ...projectResult?.config,
    ...envConfig,
    ...cliOverrides,
  };

  // 5. 应用默认值
  return {
    defaultTags: merged.defaultTags ?? DEFAULT_CONFIG.defaultTags,
    autoPublish: merged.autoPublish ?? DEFAULT_CONFIG.autoPublish,
    cacheDir: merged.cacheDir ?? DEFAULT_CONFIG.cacheDir,
  };
}

// ── 导出默认值供测试使用 ──────────────────────────────────────────────────────

export { DEFAULT_CONFIG };
