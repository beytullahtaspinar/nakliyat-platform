import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, type TokenStore } from './client.js';
import type { AuthTokens } from './types.js';

function memoryStore(initial: AuthTokens | null = null): TokenStore & { value: AuthTokens | null } {
  return {
    value: initial,
    async get() {
      return this.value;
    },
    async set(tokens) {
      this.value = tokens;
    },
  };
}

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const user = { id: 'u1', role: 'COMPANY', fullName: 'Ali Veli', phone: '+905321234567' };

describe('createApiClient', () => {
  it('girişte anahtarları saklar ve kullanıcıyı döndürür', async () => {
    const tokens = memoryStore();
    const fetch = vi.fn().mockResolvedValue(json(200, { user, accessToken: 'a1', refreshToken: 'r1' }));
    const api = createApiClient({ origin: 'https://api.test/', tokens, fetch });

    await expect(api.login('0532 123 45 67', 'Sifre123')).resolves.toEqual(user);
    expect(tokens.value).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(fetch.mock.calls[0]![0]).toBe('https://api.test/v1/auth/login');
  });

  it('hatalı girişte API mesajını gösterir', async () => {
    const fetch = vi.fn().mockResolvedValue(json(401, { message: 'Telefon numarası veya şifre hatalı' }));
    const api = createApiClient({ tokens: memoryStore(), fetch });

    await expect(api.login('0532', 'x')).rejects.toMatchObject({ status: 401, message: 'Telefon numarası veya şifre hatalı' });
  });

  it('süresi dolan erişim anahtarını bir kez yeniler ve isteği tekrarlar', async () => {
    const tokens = memoryStore({ accessToken: 'eski', refreshToken: 'r1' });
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'yeni', refreshToken: 'r2' });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer yeni' ? json(200, user) : json(401, { message: 'Unauthorized' });
    });
    const api = createApiClient({ tokens, fetch: fetch as unknown as typeof globalThis.fetch });

    // Aynı anda iki istek: yenileme tek sefer yapılmalı (anahtar tek kullanımlık)
    await Promise.all([api.me(), api.me()]);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(tokens.value).toEqual({ accessToken: 'yeni', refreshToken: 'r2' });
  });

  it('yenileme reddedilirse oturumu siler ve haber verir', async () => {
    const tokens = memoryStore({ accessToken: 'eski', refreshToken: 'r1' });
    const onSessionExpired = vi.fn();
    const fetch = vi.fn().mockResolvedValue(json(401, { message: 'Unauthorized' }));
    const api = createApiClient({ tokens, fetch, onSessionExpired });

    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(tokens.value).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it('ağ hatasını Türkçe mesaja çevirir', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    const api = createApiClient({ tokens: memoryStore({ accessToken: 'a', refreshToken: 'r' }), fetch });

    await expect(api.me()).rejects.toMatchObject({ status: 0 });
  });

  it('çıkışta ağ hatası olsa da cihazdaki oturumu siler', async () => {
    const tokens = memoryStore({ accessToken: 'a', refreshToken: 'r' });
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const api = createApiClient({ tokens, fetch });

    await api.logout();
    expect(tokens.value).toBeNull();
  });
});
