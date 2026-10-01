import { getCities } from "@nakliyat/locations";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, apiFetch, type AuthUser, type CompanyProfile } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";

type CompanyContext = { user: AuthUser; token: string; profile: CompanyProfile | null };

/** Firma paneli sayfaları için: giriş ve rol kontrolü, firma profili (henüz yoksa null). */
export const getCompanyContext = cache(async (): Promise<CompanyContext> => {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/firma-paneli");
  if (user.role !== "COMPANY") redirect(homeFor(user.role));
  const token = (await getAccessToken())!;
  try {
    const profile = await apiFetch<CompanyProfile>("/company/profile", { token });
    return { user, token, profile };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { user, token, profile: null };
    throw err;
  }
});

export const cityOptions = getCities().map((c) => ({ code: c.code, name: c.name }));
