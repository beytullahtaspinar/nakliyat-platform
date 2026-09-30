import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiFetch, type AuthTokens } from "@/lib/api";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  roleFromAccessToken,
  sessionCookies,
} from "@/lib/session-cookies";

/**
 * Erişim anahtarının süresi dolduysa yenileme anahtarıyla yenisini alır.
 *
 * Yenileme anahtarı tek kullanımlık: aynı anahtar iki kez gönderilirse API tüm oturumları kapatır.
 * Sayfa ve ön yükleme istekleri aynı anda gelebildiği için aynı anahtarla yapılan yenilemeler
 * kısa bir süre tek bir istekte birleştirilir.
 */
const inflight = new Map<string, Promise<AuthTokens | null | undefined>>();

function refreshOnce(refreshToken: string) {
  let pending = inflight.get(refreshToken);
  if (!pending) {
    pending = apiFetch<AuthTokens>("/auth/refresh", { method: "POST", body: { refreshToken } }).catch(
      // 401: oturum bitmiş (null). Ağ/sunucu hatası: oturuma dokunma (undefined).
      (err) => (err instanceof ApiError && err.status === 401 ? null : undefined),
    );
    inflight.set(refreshToken, pending);
    setTimeout(() => inflight.delete(refreshToken), 30_000);
  }
  return pending;
}

export async function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken || request.cookies.has(ACCESS_COOKIE)) return NextResponse.next();

  const tokens = await refreshOnce(refreshToken);
  if (tokens === undefined) return NextResponse.next();

  if (tokens === null) {
    for (const name of SESSION_COOKIE_NAMES) request.cookies.delete(name);
    const response = NextResponse.next({ request: { headers: request.headers } });
    for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name);
    return response;
  }

  const role = roleFromAccessToken(tokens.accessToken) ?? "CUSTOMER";
  const cookies = sessionCookies(tokens, role);
  // Aynı istekte çalışan sayfa yeni anahtarı görsün diye istek çerezlerine de yazılır.
  for (const [name, value] of cookies) request.cookies.set(name, value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const [name, value, options] of cookies) response.cookies.set(name, value, options);
  return response;
}

export const config = {
  // Statik dosyalar ve görseller hariç her istek
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
