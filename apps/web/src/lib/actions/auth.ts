"use server";

import { redirect } from "next/navigation";
import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { consentPayload } from "@/lib/legal";
import { clearSession, getAccessToken, homeFor, safeNext, saveSession, verificationPath } from "@/lib/session";

export type FormState = { error?: string };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  let result: AuthResponse;
  try {
    result = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { phone: text(formData, "phone"), password: String(formData.get("password") ?? "") },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Giriş yapılamadı." };
  }
  await saveSession(result, result.user.role);
  redirect(safeNext(formData.get("next")) ?? homeFor(result.user.role));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("kvkk") !== "on") {
    return { error: "Devam etmek için kullanım koşullarını kabul edin." };
  }
  const role = formData.get("role") === "COMPANY" ? "COMPANY" : "CUSTOMER";
  const email = text(formData, "email");
  let result: AuthResponse;
  try {
    result = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: {
        role,
        fullName: text(formData, "fullName"),
        phone: text(formData, "phone"),
        ...(email && { email }),
        password: String(formData.get("password") ?? ""),
        ...consentPayload(formData),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Kayıt tamamlanamadı." };
  }
  await saveSession(result, result.user.role);
  // E-posta kodu kayıtla birlikte gitti; doğrulama ekranından sonra asıl hedefe geçilir
  redirect(verificationPath(safeNext(formData.get("next")) ?? homeFor(result.user.role)));
}

export async function logout(formData?: FormData) {
  // Bu cihazın anlık bildirim kaydı da silinir (tarayıcıdaki abonelik LogoutForm'da bırakılır)
  const pushEndpoint = formData?.get("pushEndpoint");
  const token = await getAccessToken();
  if (typeof pushEndpoint === "string" && pushEndpoint && token) {
    await apiFetch("/notifications/push/subscriptions", { method: "DELETE", token, body: { endpoint: pushEndpoint } }).catch(
      () => undefined,
    );
  }
  const refreshToken = await clearSession();
  if (refreshToken) {
    await apiFetch("/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => undefined);
  }
  redirect(safeNext(formData?.get("next")) ?? "/");
}
