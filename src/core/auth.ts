/**
 * 墨问授权管理模块
 *
 * 与原仓库 mowen_auth.sh 功能一致
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

export interface AuthOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface AuthResult {
  authorized: boolean;
  requester: string;
  message: string;
}

/**
 * 检查授权状态
 */
export async function checkAuth(options: AuthOptions = {}): Promise<AuthResult> {
  const apiKey = options.apiKey || process.env.MOWEN_API_KEY;

  if (!apiKey) {
    return {
      authorized: false,
      requester: 'unknown',
      message: 'MOWEN_API_KEY is not set',
    };
  }

  // 尝试调用 API 验证 key 有效性
  try {
    const baseUrl = options.baseUrl || 'https://open.mowen.cn';
    const response = await fetch(`${baseUrl}/api/open/api/v1/user/info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return {
        authorized: true,
        requester: 'authenticated',
        message: 'API key is valid',
      };
    } else {
      return {
        authorized: false,
        requester: 'unknown',
        message: `API key is invalid: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      authorized: false,
      requester: 'unknown',
      message: `Auth check failed: ${error}`,
    };
  }
}

/**
 * 记录发布日志
 */
export function logPublish(
  noteId: string,
  file: string,
  result: 'success' | 'failure',
  details?: string
): void {
  const logDir = resolve(homedir(), '.claude', 'memory');

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logFile = join(logDir, 'md-to-mowen_log.md');
  const timestamp = new Date().toISOString();
  const logEntry = `\n- **${timestamp}**: ${result.toUpperCase()} - Note: ${noteId}, File: ${file}${details ? `, Details: ${details}` : ''}\n`;

  try {
    appendFileSync(logFile, logEntry);
  } catch (error) {
    console.warn('Failed to write publish log:', error);
  }
}
