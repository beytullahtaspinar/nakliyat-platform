import type { AuthResponse, AuthTokens, AuthUser } from './types.js';

export const DEFAULT_API_ORIGIN = 'https://api.evdenevenakliyat.app';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** API'nin verdiği istek kimliği; destek ve log araması için */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Anahtarların nerede saklandığını istemci bilmez: mobilde güvenli depo, testte bellek. */
export type TokenStore = {
  get(): Promise<AuthTokens | null>;
  set(tokens: AuthTokens | null): Promise<void>;
};

export type ApiClientOptions = {
  /** Örn. https://api.evdenevenakliyat.app (sonundaki /v1 istemci tarafından eklenir) */
  origin?: string;
  tokens: TokenStore;
  /** Yenileme anahtarı da geçersizse çağrılır: uygulama giriş ekranına döner */
  onSessionExpired?: () => void;
  fetch?: typeof fetch;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false: oturum anahtarı gönderilmez (giriş, kayıt, herkese açık uçlar) */
  auth?: boolean;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ origin = DEFAULT_API_ORIGIN, tokens, onSessionExpired, fetch: fetchFn = fetch }: ApiClientOptions) {
  const base = `${origin.replace(/\/$/, '')}/v1`;
  // Aynı anda düşen birden çok 401 tek yenileme isteği paylaşır; yenileme anahtarı tek kullanımlık.
  let refreshing: Promise<AuthTokens | null> | null = null;

  async function send(path: string, { method = 'GET', body }: RequestOptions, accessToken?: string) {
    try {
      return await fetchFn(`${base}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'Sunucuya ulaşılamıyor. İnternet bağlantını kontrol edip tekrar dene.');
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const requestId = (data as { requestId?: unknown } | null)?.requestId;
      const id = typeof requestId === 'string' ? requestId : undefined;
      throw new ApiError(res.status, errorMessage(res.status, data, id), id);
    }
    return data as T;
  }

  function refresh(): Promise<AuthTokens | null> {
    refreshing ??= (async () => {
      const current = await tokens.get();
      if (!current) return null;
      const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
      if (!res.ok) {
        // Sunucu hatasında oturumu silme; yalnızca anahtar reddedildiyse çıkış yap.
        if (res.status === 401 || res.status === 403) {
          await tokens.set(null);
          onSessionExpired?.();
          return null;
        }
        throw new ApiError(res.status, errorMessage(res.status, await res.json().catch(() => null)));
      }
      const next = (await res.json()) as AuthTokens;
      await tokens.set(next);
      return next;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (options.auth === false) return parse<T>(await send(path, options));

    const current = await tokens.get();
    if (!current) {
      onSessionExpired?.();
      throw new ApiError(401, 'Oturumun kapandı, tekrar giriş yap.');
    }
    let res = await send(path, options, current.accessToken);
    if (res.status === 401) {
      const next = await refresh();
      if (!next) throw new ApiError(401, 'Oturumun kapandı, tekrar giriş yap.');
      res = await send(path, options, next.accessToken);
    }
    return parse<T>(res);
  }

  return {
    request,

    /** Telefon + şifre ile giriş; anahtarlar depoya yazılır. */
    async login(phone: string, password: string): Promise<AuthUser> {
      const res = await request<AuthResponse>('/auth/login', { method: 'POST', body: { phone, password }, auth: false });
      await tokens.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      return res.user;
    },

    /** Sunucudaki yenileme anahtarını iptal eder; ağ hatası olsa da cihazdaki oturum silinir. */
    async logout(): Promise<void> {
      const current = await tokens.get();
      await tokens.set(null);
      if (!current) return;
      await send('/auth/logout', { method: 'POST', body: { refreshToken: current.refreshToken } }).catch(() => undefined);
    },

    me(): Promise<AuthUser> {
      return request<AuthUser>('/auth/me');
    },
  };
}

/** API hata gövdesinden kullanıcıya gösterilebilir Türkçe mesajı çıkarır. */
export function errorMessage(status: number, data: unknown, requestId?: string): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && status < 500) return message;
  if (Array.isArray(message)) return 'Formdaki bilgileri kontrol et.';
  if (status === 429) return 'Çok fazla deneme yapıldı, bir dakika sonra tekrar dene.';
  const code = requestId ? ` (hata kodu: ${requestId})` : '';
  return `Beklenmeyen bir hata oluştu, lütfen tekrar dene.${code}`;
}
