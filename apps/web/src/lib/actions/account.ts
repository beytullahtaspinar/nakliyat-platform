"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch, type AuthTokens } from "@/lib/api";
import { clearSession, getAccessToken, getCurrentUser, saveSession } from "@/lib/session";

export type DeleteAccountState = { error?: string };

/** Oturumdaki hesabı siler, oturumu kapatır ve onay sayfasına döner. */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (formData.get("onay") !== "on") return { error: "Silmeyi onaylamak için kutuyu işaretle." };
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  const password = String(formData.get("password") ?? "");
  try {
    await apiFetch("/auth/me", { method: "DELETE", token, body: password ? { password } : {} });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Hesap silinemedi, tekrar dene." };
  }
  await clearSession();
  redirect("/hesap-silme?silindi=1");
}

export type AccountFormState = { error?: string; saved?: boolean };

/** Ad soyadı düzeltir (Hesap bilgileri). Panel başlığı ve menü yeni adla yenilenir. */
export async function updateName(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  const fullName = String(formData.get("fullName") ?? "").trim();
  try {
    await apiFetch("/auth/me", { method: "PATCH", token, body: { fullName } });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Adın kaydedilemedi, tekrar dene." };
  }
  revalidatePath("/hesabim", "layout");
  return { saved: true };
}

/** Şifre değiştirir ve Hesap bilgilerine döner. Diğer cihazlardaki oturumlar kapanır; bu cihaz yeni anahtarlarla devam eder. */
export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const token = await getAccessToken();
  const user = await getCurrentUser();
  if (!token || !user) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword !== String(formData.get("newPasswordAgain") ?? "")) return { error: "Yeni şifreler aynı değil." };
  try {
    const tokens = await apiFetch<AuthTokens>("/auth/change-password", {
      method: "POST",
      token,
      body: { currentPassword, newPassword },
    });
    await saveSession(tokens, user.role);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Şifren değiştirilemedi, tekrar dene." };
  }
  // Çerezler yenilendiği için sayfa yeniden çizilir; sonuç adresten okunur
  redirect("/hesabim/hesap?sifre=degisti#sifre");
}
