"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { COMPANY_CACHE_TAG } from "@/lib/reviews";
import { getAccessToken } from "@/lib/session";

export type ReportActionState = { error?: string; notice?: string };

/** Yönetici bildirimi kapatır; "kaldır" seçilirse mesaj silinir, yorum gizlenir ya da firma yanıtı silinir. */
export async function resolveReport(reportId: string, _prev: ReportActionState, formData: FormData): Promise<ReportActionState> {
  const decision = String(formData.get("decision") ?? "");
  if (!["remove", "keep", "dismiss"].includes(decision)) return { error: "Bir karar seç." };
  const resolution = String(formData.get("resolution") ?? "").trim().slice(0, 500);
  if (decision === "remove" && resolution.length < 5) {
    return { error: "İçerik kaldırılırken gerekçe yaz (en az 5 karakter). Yorum gizlenirse firma bu gerekçeyi görür." };
  }
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen sayfayı yenileyip tekrar giriş yap." };
  try {
    await apiFetch(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: "POST",
      token,
      body: {
        status: decision === "dismiss" ? "DISMISSED" : "RESOLVED",
        removeContent: decision === "remove",
        ...(resolution && { resolution }),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Şikayet kapatılamadı, lütfen tekrar dene." };
  }
  revalidatePath("/yonetim", "layout");
  // Gizlenen yorum ya da silinen firma yanıtı herkese açık firma sayfasından da kalksın
  if (decision === "remove") updateTag(COMPANY_CACHE_TAG);
  return { notice: "Şikayet kapatıldı." };
}

const REASONS = ["SPAM", "ABUSE", "INAPPROPRIATE", "FRAUD", "OTHER"] as const;
const TARGETS = ["MESSAGE", "REVIEW", "REVIEW_REPLY"] as const;

/** Müşteri ya da firma bir mesajı, yorumu veya firma yanıtını yönetime bildirir (/yonetim/sikayetler). */
export async function reportContent(
  target: (typeof TARGETS)[number],
  targetId: string,
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const reason = String(formData.get("reason") ?? "");
  if (!(REASONS as readonly string[]).includes(reason) || !(TARGETS as readonly string[]).includes(target)) {
    return { error: "Bir neden seç." };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen sayfayı yenileyip tekrar giriş yap." };
  try {
    await apiFetch("/reports", { method: "POST", token, body: { target, targetId, reason, ...(note && { note }) } });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Bildirim gönderilemedi, lütfen tekrar dene." };
  }
  return { notice: "Bildirimin alındı. Ekibimiz en geç 24 saat içinde inceler." };
}
