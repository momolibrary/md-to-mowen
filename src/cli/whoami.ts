import type { MowenProfile } from '../mowen/client.js';

// ── 结果类型 ─────────────────────────────────────────────────────────────────

export interface WhoamiError {
  code?: number;
  reason?: string;
  message: string;
}

export interface WhoamiResult {
  /** MOWEN_API_KEY 是否已设置 */
  configured: boolean;
  /** 是否完成了联网验证（--local / 网络错误 / 服务端错误 时为 false） */
  verified: boolean;
  /** true=Key 有效；false=Key 无效/失效；null=未能联网验证 */
  authenticated: boolean | null;
  /** 脱敏后的 API Key，原始 Key 永不输出 */
  maskedKey: string | null;
  /** 来源标签，如 "~/.md-to-mowen.env" / "环境变量" */
  source: string | null;
  profile?: MowenProfile | null;
  error?: WhoamiError | null;
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/** 脱敏 API Key：保留前 8 位与后 4 位（与 config 命令风格一致） */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return '***';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/** 判定 MowenApiError 是否为鉴权失败（Key 无效/失效） */
export function isAuthError(err: { code?: number; reason?: string }): boolean {
  return (
    err.reason === 'LOGIN' ||
    err.reason === 'AUTH' ||
    err.code === 401 ||
    err.code === 40301 ||
    err.code === 40303
  );
}

/** 格式化会员状态文本 */
function formatMember(profile: MowenProfile): string {
  const pro = profile.member?.status?.pro;
  if (typeof pro !== 'number' || pro <= 0) return '非会员';

  const expiredAt = profile.member?.expiredAt;
  const ts = expiredAt ? Number(expiredAt) : NaN;
  if (!Number.isFinite(ts)) return 'Pro 会员';

  const date = new Date(ts).toISOString().slice(0, 10);
  return ts < Date.now() ? `Pro 会员（已于 ${date} 过期）` : `Pro 会员（有效期至 ${date}）`;
}

// ── 格式化输出 ───────────────────────────────────────────────────────────────

export function formatWhoamiText(r: WhoamiResult): string {
  // 未配置
  if (!r.configured) {
    return [
      '❌ 未配置 MOWEN_API_KEY',
      '',
      '请先运行以下命令配置 API Key：',
      '  md-to-mowen config',
      '',
      '获取方式：微信小程序"墨问" → 个人主页 → 开发者 → 我的 API Key',
    ].join('\n');
  }

  const keyLine = `   API Key：${r.maskedKey}${r.source ? ` (来源：${r.source})` : ''}`;

  // 已配置但未联网验证（--local / 网络错误 / 服务端错误）
  if (!r.verified) {
    const lines = ['⚠️  已配置（未联网验证）', keyLine];
    if (r.error?.message) lines.push(`   原因：${r.error.message}`);
    return lines.join('\n');
  }

  // 联网验证通过
  if (r.authenticated) {
    const lines = ['✅ 已登录', keyLine];
    const base = r.profile?.base;
    if (base) {
      lines.push(`   账号：${base.name}`);
      lines.push(`   UID：${base.uid}`);
      lines.push(`   会员：${formatMember(r.profile!)}`);
    }
    return lines.join('\n');
  }

  // 鉴权失败：Key 无效或已失效
  const lines = ['❌ API Key 无效或已失效', keyLine];
  if (r.error?.message) lines.push(`   原因：${r.error.message}`);
  lines.push('', '请重新运行以下命令配置 API Key：', '  md-to-mowen config');
  return lines.join('\n');
}

/** 格式化为 JSON */
export function formatWhoamiJson(r: WhoamiResult): string {
  return JSON.stringify(r, null, 2) + '\n';
}
