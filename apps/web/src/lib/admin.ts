import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthUser } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";

/** Yönetim sayfaları için: giriş ve rol kontrolü. Asıl yetki kararı API'de (yalnızca ADMIN). */
export const getAdminContext = cache(async (): Promise<{ user: AuthUser; token: string }> => {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/yonetim");
  if (user.role !== "ADMIN") redirect(homeFor(user.role));
  return { user, token: (await getAccessToken())! };
});

/** ?sayfa=3 → 3; geçersizse 1 */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
