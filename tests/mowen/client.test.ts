import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MowenClient, MowenApiError, Visibility } from '../../src/mowen/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MowenClient', () => {
  const client = new MowenClient('test-api-key');

  describe('setPrivacy', () => {
    it('正确调用隐私设置 API（public）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.setPrivacy('note-123', 'public');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://open.mowen.cn/api/open/api/v1/note/settings');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        noteId: 'note-123',
        section: 1,
        settings: {
          privacy: {
            type: 'public',
          },
        },
      });
    });

    it('正确调用隐私设置 API（private）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.setPrivacy('note-456', 'private');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://open.mowen.cn/api/open/api/v1/note/settings');
      expect(JSON.parse(options.body)).toEqual({
        noteId: 'note-456',
        section: 1,
        settings: {
          privacy: {
            type: 'private',
          },
        },
      });
    });

    it('API 返回错误时抛出 MowenApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ code: 404, reason: '笔记不存在' }),
      });

      await expect(client.setPrivacy('invalid-note', 'public')).rejects.toThrow('[404] 笔记不存在');
    });

    it('API 返回业务错误时抛出 MowenApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 40001, reason: '无权限操作该笔记' }),
      });

      await expect(client.setPrivacy('note-other', 'private')).rejects.toThrow(
        '[40001] 无权限操作该笔记'
      );
    });
  });

  describe('getMyProfile', () => {
    it('以 GET 方式调用 my/profile 并返回 profile 对象', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: {
            base: { uid: 'u1', name: '墨问用户', intro: 'intro' },
            member: { status: { pro: 64 }, code: 'V-XXX', expiredAt: '1845383306889' },
          },
        }),
      });

      const profile = await client.getMyProfile();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://open.mowen.cn/api/open/api/v1/my/profile');
      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
      expect(profile.base.uid).toBe('u1');
      expect(profile.base.name).toBe('墨问用户');
      expect(profile.member?.status?.pro).toBe(64);
    });

    it('Key 无效时抛出 MowenApiError 并携带 reason=LOGIN', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ code: 400, reason: 'LOGIN', message: 'invalid api key.' }),
      });

      try {
        await client.getMyProfile();
        expect.unreachable('应抛出 MowenApiError');
      } catch (e) {
        expect(e).toBeInstanceOf(MowenApiError);
        const err = e as MowenApiError;
        expect(err.code).toBe(400);
        expect(err.reason).toBe('LOGIN');
        expect(err.message).toBe('[400] LOGIN');
      }
    });
  });
});
