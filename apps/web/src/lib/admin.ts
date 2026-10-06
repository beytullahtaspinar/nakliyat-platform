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

export { oneParam, pageParam } from "@/lib/params";
