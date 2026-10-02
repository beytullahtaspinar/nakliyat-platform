import { cookies } from "next/headers";
import { cache } from "react";
import { ApiError, apiFetch, type AuthTokens, type AuthUser, type UserRole } from "@/lib/api";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  sessionCookies,
} from "@/lib/session-cookies";

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/**
 * Oturumdaki kullanıcı; giriş yapılmamışsa null.
 * Süresi dolan erişim anahtarını proxy yeniler, burada yalnızca okunur.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await apiFetch<AuthUser>("/auth/me", { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
});

/** Yalnızca Server Action içinde çağrılabilir. */
export async function saveSession(tokens: AuthTokens, role: UserRole) {
  const store = await cookies();
  for (const [name, value, options] of sessionCookies(tokens, role)) {
    store.set(name, value, options);
  }
}

/** Yalnızca Server Action içinde çağrılabilir. */
export async function clearSession(): Promise<string | undefined> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  for (const name of SESSION_COOKIE_NAMES) store.delete(name);
  return refreshToken;
}

/** Giriş sonrası dönülecek adres: yalnızca site içi yollar kabul edilir. */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : undefined;
}

/** Kayıttan sonra ya da doğrulanmamış hesapla korumalı bir işe girişince gidilen sayfa */
export function verificationPath(next?: string): string {
  return next ? `/dogrulama?next=${encodeURIComponent(next)}` : "/dogrulama";
}

export function homeFor(role: UserRole): string {
  if (role === "COMPANY") return "/firma-paneli";
  if (role === "ADMIN") return "/yonetim";
  return "/hesabim";
}
