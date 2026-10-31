"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import { SITE_SETTINGS_CACHE_TAG } from "@/lib/site-settings";

export type SiteSettingsActionState = {
  error?: string;
  notice?: string;
  /** Hata olursa yazılanlar formda kalsın */
  values?: Record<Engine, string>;
};

type Engine = "google" | "bing" | "yandex";
const ENGINES: { name: Engine; label: string }[] = [
  { name: "google", label: "Google" },
  { name: "bing", label: "Bing" },
  { name: "yandex", label: "Yandex" },
];
/** API ile aynı kural (site-settings.service.ts VERIFICATION_CODE_PATTERN) */
const CODE = /^[A-Za-z0-9_-]{1,100}$/;

/** Meta etiketinin tamamı yapıştırıldıysa content değerini alır */
const extract = (raw: string) => /content\s*=\s*["']([^"']*)["']/i.exec(raw)?.[1].trim() ?? raw;

/** Arama motoru doğrulama kodları; boş bırakılan kod kaldırılır. Ana sayfa hemen yenilenir (arama motoru orada arar). */
export async function saveSearchVerification(_prev: SiteSettingsActionState, formData: FormData): Promise<SiteSettingsActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  const values = Object.fromEntries(ENGINES.map((e) => [e.name, String(formData.get(e.name) ?? "").trim()])) as Record<Engine, string>;
  const body = Object.fromEntries(ENGINES.map((e) => [e.name, extract(values[e.name])])) as Record<Engine, string>;
  const invalid = ENGINES.find((e) => body[e.name] && !CODE.test(body[e.name]));
  if (invalid) {
    return {
      values,
      error: `${invalid.label} doğrulama kodu yalnızca harf, rakam, - ve _ içerebilir. Etiketin tamamını ya da yalnızca content="…" içindeki kodu yapıştır.`,
    };
  }
  try {
    await apiFetch("/admin/site-settings", { method: "PATCH", token: (await getAccessToken())!, body });
  } catch (err) {
    return { values, error: err instanceof ApiError ? err.message : "Kodlar kaydedilemedi, biraz sonra tekrar deneyin." };
  }
  updateTag(SITE_SETTINGS_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/yonetim/arama-motorlari");
  return { notice: "Kaydedildi. Kod ana sayfada yayında; şimdi arama motorunun panelinde “Doğrula”ya basabilirsin." };
}
