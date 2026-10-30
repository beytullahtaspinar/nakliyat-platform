"use server";

import { revalidatePath, updateTag } from "next/cache";
import sitemap from "@/app/sitemap";
import { ApiError, apiFetch } from "@/lib/api";
import { describeIndexNowError, notifyIndexNow, submitToIndexNow } from "@/lib/indexnow";
import { LOCAL_PAGE_CACHE_TAG } from "@/lib/local-page-content";
import { getAccessToken, getCurrentUser } from "@/lib/session";

export type LocalPageActionState = { error?: string; notice?: string };

async function adminToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  return (await getAccessToken())!;
}

/** Sitedeki sayfa hemen yenilensin: önbellek etiketi + derlemede üretilen sayfa (o sırada API'ye ulaşılamadıysa etiket taşımaz) */
function refresh(slug: string) {
  updateTag(LOCAL_PAGE_CACHE_TAG);
  revalidatePath(`/${slug}`);
  revalidatePath("/yonetim/sayfalar", "layout");
  notifyIndexNow([`/${slug}`]);
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function saveLocalPage(slug: string, _prev: LocalPageActionState, formData: FormData): Promise<LocalPageActionState> {
  let faq: unknown = [];
  try {
    faq = JSON.parse(text(formData, "faq") || "[]");
  } catch {
    return { error: "Sık sorulan sorular okunamadı, sayfayı yenileyip tekrar deneyin." };
  }
  const body = {
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    heading: text(formData, "heading"),
    intro: text(formData, "intro"),
    content: String(formData.get("content") ?? ""),
    faq,
    coverKey: text(formData, "coverKey"),
    coverAlt: text(formData, "coverAlt"),
  };
  try {
    const saved = await apiFetch<object | null>(`/admin/local-pages/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      token: await adminToken(),
      body,
    });
    refresh(slug);
    return { notice: saved ? "Kaydedildi; sitedeki sayfa güncellendi." : "Tüm alanlar boş: sayfa otomatik metne döndü." };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Sayfa kaydedilemedi." };
  }
}

/** Varsayılana dön: sayfa yeniden tamamen otomatik metinle çizilir */
export async function resetLocalPage(slug: string): Promise<LocalPageActionState> {
  try {
    await apiFetch(`/admin/local-pages/${encodeURIComponent(slug)}`, { method: "DELETE", token: await adminToken() });
    refresh(slug);
    return { notice: "Sayfa otomatik metne döndü." };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Sayfa varsayılana döndürülemedi." };
  }
}

/** Site haritasındaki tüm adresleri Bing/Yandex'e bildirir (ilk kurulumda ya da toplu değişiklikten sonra) */
export async function submitSitemapToIndexNow(): Promise<LocalPageActionState> {
  try {
    await adminToken();
    const count = await submitToIndexNow((await sitemap()).map((entry) => entry.url));
    return count
      ? { notice: `${count} adres Bing ve Yandex'e bildirildi.` }
      : { error: "Bildirim bu ortamda kapalı (yalnızca canlı sitede çalışır)." };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    console.error("Tüm sayfalar IndexNow'a bildirilemedi:", err);
    return { error: describeIndexNowError(err) };
  }
}
