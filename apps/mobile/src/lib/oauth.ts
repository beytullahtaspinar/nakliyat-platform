import type { AuthResponse } from '@nakliyat/api-client';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { api } from './api';
import { variant, WEB_ORIGIN } from './variant';

export type OAuthProviderId = 'google' | 'apple';
export const PROVIDER_LABELS: Record<OAuthProviderId, string> = { google: 'Google', apple: 'Apple' };

export type OAuthOutcome =
  | ({ status: 'signed_in' } & AuthResponse)
  | { status: 'signup_required'; signupToken: string; profile: { fullName: string | null; email: string | null } }
  | { status: 'cancelled' };

/** Sitedeki giriş hata kodları (apps/web/src/lib/oauth.ts OAUTH_ERRORS) */
const ERRORS: Record<string, string> = {
  iptal: 'Giriş iptal edildi.',
  sure: 'Giriş süresi doldu ya da yarım kaldı, lütfen tekrar dene.',
  'hesap-var': 'Bu e-posta adresiyle açılmış bir hesap var. Telefon numaran ve şifrenle giriş yap.',
  kapali: 'Bu giriş yöntemi henüz açık değil.',
  genel: 'Giriş yapılamadı, lütfen tekrar dene.',
};

/** API'de anahtarı tanımlı sağlayıcılar; ulaşılamazsa düğme gösterilmez */
export async function enabledProviders(): Promise<OAuthProviderId[]> {
  try {
    const { providers } = await api.request<{ providers: string[] }>('/auth/oauth/providers', { auth: false });
    return providers.filter((p): p is OAuthProviderId => p === 'google' || p === 'apple');
  } catch {
    return [];
  }
}

const base64url = (base64: string) => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function randomVerifier() {
  const bytes = Crypto.getRandomBytes(32);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return base64url(btoa(binary));
}

/** Dönüş adresinin sorgusu (Hermes'te URLSearchParams eksik) */
function readQuery(url: string): Record<string, string> {
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  return Object.fromEntries(
    query
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const [k, v = ''] = pair.split('=');
        return [decodeURIComponent(k!), decodeURIComponent(v.replace(/\+/g, ' '))];
      }),
  );
}

/**
 * Google / Apple ile giriş. Sitedeki giriş akışı uygulama içi tarayıcı penceresinde çalışır
 * (anahtarlar yalnızca sunucuda); dönüşte site uygulamaya bir devir belirteci verir. Belirteç yalnızca
 * bu telefonda üretilen gizli değerle oturuma çevrilebilir. Ayrıntı: docs/google-apple-giris.md
 */
export async function signInWithProvider(provider: OAuthProviderId): Promise<OAuthOutcome> {
  const verifier = randomVerifier();
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = base64url(digest);
  const scheme = Constants.expoConfig?.scheme as string;
  const returnUrl = `${scheme}://oauth`;
  const result = await WebBrowser.openAuthSessionAsync(
    `${WEB_ORIGIN}/api/giris/${provider}?uygulama=${variant}&kod=${challenge}`,
    returnUrl,
    { preferEphemeralSession: false },
  );
  if (result.type !== 'success') return { status: 'cancelled' };

  const query = readQuery(result.url);
  if (query.hata === 'iptal') return { status: 'cancelled' };
  if (!query.handoff) throw new Error(ERRORS[query.hata ?? ''] ?? ERRORS.genel);
  return api.request<OAuthOutcome>('/auth/oauth/app/exchange', {
    method: 'POST',
    body: { handoff: query.handoff, appVerifier: verifier },
    auth: false,
  });
}
