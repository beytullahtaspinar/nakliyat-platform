import { apiFetch, type AuthResponse } from "@/lib/api";

/** Google / Apple girişi sırasında tarayıcıda bekleyen bilgiler (10 dk) */
export const OAUTH_COOKIE = "nk_oauth";
/** Sağlayıcıdan döndü ama hesabı yok: telefon ve rol sorulana kadar kayıt belirteci (20 dk) */
export const SIGNUP_COOKIE = "nk_kayit";

export type OAuthPending = {
  provider: string;
  state: string;
  nonce: string;
  verifier: string;
  next?: string;
  role?: "CUSTOMER" | "COMPANY";
  /** Mobil uygulamadan başlatıldıysa: dönüşte uygulamaya gidilecek adres şeması ve uygulamanın PKCE değeri */
  app?: { scheme: string; challenge: string };
};

/** Mobil uygulamaların adres şemaları (apps/mobile/app.config.ts); başka şemaya yönlendirilmez */
export const APP_SCHEMES: Record<string, string> = { firma: "evdenevenakliyat-firma", musteri: "evdenevenakliyat" };

/** Uygulamaya dönüş: giriş penceresi bu adresi görünce kapanır, uygulama sonucu okur */
export const appReturn = (scheme: string, params: Record<string, string>) =>
  seeOther(`${scheme}://oauth?${new URLSearchParams(params)}`);

export type OAuthResult =
  | ({ status: "signed_in" } & AuthResponse)
  | { status: "signup_required"; signupToken: string; profile: { fullName: string | null; email: string | null } }
  | { status: "app_handoff"; handoff: string };

export const PROVIDER_LABELS: Record<string, string> = { google: "Google", apple: "Apple", test: "Test" };

/** API'de anahtarı tanımlı sağlayıcılar; API'ye ulaşılamazsa düğme gösterilmez */
export async function getOAuthProviders(): Promise<string[]> {
  try {
    return (await apiFetch<{ providers: string[] }>("/auth/oauth/providers")).providers;
  } catch {
    return [];
  }
}

/**
 * Giriş sayfasında gösterilen hata. Adreste metin değil kod taşınır: başkası /giris?hata=... ile
 * sayfaya kendi yazısını koyamasın.
 */
export const OAUTH_ERRORS = {
  iptal: "Giriş iptal edildi.",
  sure: "Giriş süresi doldu ya da yarım kaldı, lütfen tekrar dene.",
  "hesap-var": "Bu e-posta adresiyle açılmış bir hesap var. Telefon numaran ve şifrenle giriş yap.",
  kapali: "Bu giriş yöntemi henüz açık değil.",
  genel: "Giriş yapılamadı, lütfen tekrar dene.",
} as const;
export type OAuthErrorCode = keyof typeof OAUTH_ERRORS;

export function oauthErrorCode(status: number): OAuthErrorCode {
  if (status === 409) return "hesap-var";
  if (status === 503) return "kapali";
  return "genel";
}

/** Sayfa içi yönlendirme (göreli Location; Passenger arkasında istek adresi iç adres olabilir) */
export function seeOther(path: string) {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}
