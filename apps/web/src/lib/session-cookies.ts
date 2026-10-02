import type { AuthTokens, UserRole } from "@/lib/api";

/** Kısa ömürlü erişim anahtarı (API'de 15 dk; çerez biraz önce düşer ki süresi dolmuş anahtar gönderilmesin) */
export const ACCESS_COOKIE = "nk_at";
/** Tek kullanımlık yenileme anahtarı (30 gün) */
export const REFRESH_COOKIE = "nk_rt";
/** Yalnızca arayüz için: başlıkta "Hesabım" göstermek. Yetki kararı buna göre verilmez. */
export const ROLE_COOKIE = "nk_rol";
/**
 * Yöneticinin firma panelini firmanın gözünden görüntülediği kısa ömürlü anahtar. Yalnızca
 * /firma-paneli altına gönderilir; yönetici kendi oturumunu kaybetmez, diğer sayfalarda kendisidir.
 */
export const IMPERSONATION_COOKIE = "nk_firma_gorunum";
export const IMPERSONATION_PATH = "/firma-paneli";

const ACCESS_MAX_AGE = 14 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

const base = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

/** Oturum çerezleri: ad, değer, seçenekler */
export function sessionCookies(
  tokens: AuthTokens,
  role: UserRole,
): [string, string, CookieOptions][] {
  return [
    [ACCESS_COOKIE, tokens.accessToken, { ...base, httpOnly: true, maxAge: ACCESS_MAX_AGE }],
    [REFRESH_COOKIE, tokens.refreshToken, { ...base, httpOnly: true, maxAge: REFRESH_MAX_AGE }],
    [ROLE_COOKIE, role, { ...base, httpOnly: false, maxAge: REFRESH_MAX_AGE }],
  ];
}

export const SESSION_COOKIE_NAMES = [ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE];

/** Erişim anahtarının içindeki rolü okur (imza API'de doğrulanır; burada yalnızca çerez yenilemek için). */
export function roleFromAccessToken(token: string): UserRole | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.role;
  } catch {
    return undefined;
  }
}
