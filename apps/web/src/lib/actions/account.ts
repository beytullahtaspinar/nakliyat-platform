"use server";

import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { clearSession, getAccessToken } from "@/lib/session";

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
