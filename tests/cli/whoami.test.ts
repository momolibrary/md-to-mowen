import { describe, it, expect } from 'vitest';
import type { MowenProfile } from '../../src/mowen/client.js';
import {
  maskApiKey,
  isAuthError,
  formatWhoamiText,
  formatWhoamiJson,
  type WhoamiResult,
} from '../../src/cli/whoami.js';

// ── 测试数据 ────────────────────────────────────────────────────────────────

const profile: MowenProfile = {
  base: { uid: 'j8drCp_T4fh3ERzT2Cedr', name: '八老师不摄影', intro: 'intro' },
  avatar: null,
  relation: null,
  member: { status: { pro: 64 }, code: 'V-4QTUK1CMQH', expiredAt: '1845383306889' },
  extra: null,
};

// ── maskApiKey ──────────────────────────────────────────────────────────────

describe('maskApiKey', () => {
  it('长 Key 保留前 8 位与后 4 位', () => {
    // 输入刻意 < 24 字符，避免被 PII 扫描误判为硬编码密钥（P2）
    expect(maskApiKey('RqWjrzJTabcd3znS')).toBe('RqWjrzJT...3znS');
  });

  it('过短 Key 返回 ***', () => {
    expect(maskApiKey('short')).toBe('***');
  });

  it('刚好 12 位也视为过短', () => {
    expect(maskApiKey('123456789012')).toBe('***');
  });
});

// ── isAuthError ─────────────────────────────────────────────────────────────

describe('isAuthError', () => {
  it('reason=LOGIN 判定为鉴权失败', () => {
    expect(isAuthError({ code: 400, reason: 'LOGIN' })).toBe(true);
  });

  it('reason=AUTH 判定为鉴权失败', () => {
    expect(isAuthError({ code: 1, reason: 'AUTH' })).toBe(true);
  });

  it('code 40301 判定为鉴权失败', () => {
    expect(isAuthError({ code: 40301, reason: '未授权' })).toBe(true);
  });

  it('code 40303 判定为鉴权失败', () => {
    expect(isAuthError({ code: 40303, reason: 'Key 已重置' })).toBe(true);
  });

  it('非鉴权错误（如 PARAMS / RATELIMIT）不判定为鉴权失败', () => {
    expect(isAuthError({ code: 400, reason: 'PARAMS' })).toBe(false);
    expect(isAuthError({ code: 429, reason: 'RATELIMIT' })).toBe(false);
  });
});

// ── formatWhoamiText ────────────────────────────────────────────────────────

describe('formatWhoamiText', () => {
  it('未配置时显示未配置提示', () => {
    const out = formatWhoamiText({
      configured: false,
      verified: false,
      authenticated: false,
      maskedKey: null,
      source: null,
      profile: null,
      error: null,
    });
    expect(out).toContain('未配置 MOWEN_API_KEY');
    expect(out).toContain('md-to-mowen config');
  });

  it('已登录时显示账号/UID/会员', () => {
    const out = formatWhoamiText({
      configured: true,
      verified: true,
      authenticated: true,
      maskedKey: 'RqWjrzJT...3znS',
      source: '~/.md-to-mowen.env',
      profile,
      error: null,
    });
    expect(out).toContain('✅ 已登录');
    expect(out).toContain('RqWjrzJT...3znS');
    expect(out).toContain('~/.md-to-mowen.env');
    expect(out).toContain('八老师不摄影');
    expect(out).toContain('j8drCp_T4fh3ERzT2Cedr');
    expect(out).toContain('Pro 会员');
  });

  it('未联网验证时显示已配置（未联网验证）', () => {
    const out = formatWhoamiText({
      configured: true,
      verified: false,
      authenticated: null,
      maskedKey: 'RqWjrzJT...3znS',
      source: '~/.md-to-mowen.env',
      profile: null,
      error: null,
    });
    expect(out).toContain('已配置（未联网验证）');
    expect(out).toContain('RqWjrzJT...3znS');
  });

  it('网络错误时附带原因', () => {
    const out = formatWhoamiText({
      configured: true,
      verified: false,
      authenticated: null,
      maskedKey: 'RqWjrzJT...3znS',
      source: '~/.md-to-mowen.env',
      profile: null,
      error: { message: '[429] RATELIMIT' },
    });
    expect(out).toContain('已配置（未联网验证）');
    expect(out).toContain('原因：[429] RATELIMIT');
  });

  it('Key 失效时显示无效或已失效并提示重新配置', () => {
    const out = formatWhoamiText({
      configured: true,
      verified: true,
      authenticated: false,
      maskedKey: 'bad_inva..._key',
      source: '~/.md-to-mowen.env',
      profile: null,
      error: { code: 400, reason: 'LOGIN', message: '[400] LOGIN' },
    });
    expect(out).toContain('API Key 无效或已失效');
    expect(out).toContain('原因：[400] LOGIN');
    expect(out).toContain('md-to-mowen config');
  });
});

// ── formatWhoamiJson ────────────────────────────────────────────────────────

describe('formatWhoamiJson', () => {
  it('输出合法 JSON 并包含核心字段', () => {
    const result: WhoamiResult = {
      configured: true,
      verified: true,
      authenticated: true,
      maskedKey: 'RqWjrzJT...3znS',
      source: '~/.md-to-mowen.env',
      profile,
      error: null,
    };
    const parsed = JSON.parse(formatWhoamiJson(result));
    expect(parsed.configured).toBe(true);
    expect(parsed.verified).toBe(true);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.maskedKey).toBe('RqWjrzJT...3znS');
    expect(parsed.profile.base.uid).toBe('j8drCp_T4fh3ERzT2Cedr');
  });

  it('未配置时输出 configured=false', () => {
    const parsed = JSON.parse(
      formatWhoamiJson({
        configured: false,
        verified: false,
        authenticated: false,
        maskedKey: null,
        source: null,
        profile: null,
        error: null,
      })
    );
    expect(parsed.configured).toBe(false);
    expect(parsed.maskedKey).toBeNull();
  });
});
