"use server";

import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";

export type PasswordResetState = {
  error?: string;
  /** Kodun gönderildiği adres; doluysa ekran kod ve yeni şifre adımına geçer */
  sentTo?: string;
  /** Yeni kod bu andan sonra istenebilir */
  resendAt?: string;
};

const RESEND_INTERVAL_MS = 60_000;

/**
 * "Şifremi unuttum" ekranındaki iki form: kod iste / kodla yeni şifre belirle.
 * API, adres kayıtlı olmasa da aynı yanıtı verir; ekran da her durumda kod adımına geçer.
 */
export async function passwordResetStep(_prev: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "E-posta adresini yaz." };

  if (formData.get("intent") === "send") {
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : "Kod gönderilemedi, lütfen tekrar dene." };
    }
    return { sentTo: email, resendAt: new Date(Date.now() + RESEND_INTERVAL_MS).toISOString() };
  }

  const keep = { sentTo: email, resendAt: String(formData.get("resendAt") ?? "") || undefined };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("passwordAgain") ?? "")) {
    return { ...keep, error: "Şifreler aynı değil." };
  }
  try {
    await apiFetch("/auth/reset-password", {
      method: "POST",
      body: { email, code: String(formData.get("code") ?? "").replace(/\D/g, ""), password },
    });
  } catch (err) {
    return { ...keep, error: err instanceof ApiError ? err.message : "Şifre değiştirilemedi, lütfen tekrar dene." };
  }
  redirect("/giris?sifre=yenilendi");
}
