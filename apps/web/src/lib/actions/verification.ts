"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch, type ContactVerification } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor, safeNext } from "@/lib/session";

export type VerificationFormState = { error?: string; notice?: string };

const ENDPOINTS = {
  "email-send": "/auth/verification/email/send",
  "email-confirm": "/auth/verification/email/confirm",
  "phone-send": "/auth/verification/phone/send",
  "phone-confirm": "/auth/verification/phone/confirm",
} as const;

/**
 * Doğrulama ekranındaki tüm formlar: kod gönder / kodu onayla (e-posta ve telefon).
 * Doğrulama tamamlanınca kullanıcı geldiği sayfaya (next) döner.
 */
export async function verificationStep(_prev: VerificationFormState, formData: FormData): Promise<VerificationFormState> {
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  const intent = String(formData.get("intent")) as keyof typeof ENDPOINTS;
  if (!(intent in ENDPOINTS)) return { error: "Geçersiz işlem." };

  const body =
    intent === "email-send"
      ? { ...(formData.get("email") ? { email: String(formData.get("email")).trim() } : {}) }
      : intent.endsWith("confirm")
        ? { code: String(formData.get("code") ?? "").replace(/\D/g, "") }
        : {};

  let status: ContactVerification;
  try {
    status = await apiFetch<ContactVerification>(ENDPOINTS[intent], { method: "POST", token, body });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "İşlem tamamlanamadı, lütfen tekrar dene." };
  }
  revalidatePath("/dogrulama");

  if (intent.endsWith("confirm") && status.complete) {
    const user = await getCurrentUser();
    redirect(safeNext(formData.get("next")) ?? (user ? homeFor(user.role) : "/"));
  }
  // Ekran yenilenen duruma göre kendini günceller (kod alanı açılır, adım tamamlandı görünür)
  if (intent === "email-send") return { notice: `Kodu ${status.emailCodeSentTo} adresine gönderdik.` };
  return {};
}
