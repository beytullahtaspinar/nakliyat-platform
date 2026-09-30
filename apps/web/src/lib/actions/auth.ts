"use server";

import { redirect } from "next/navigation";
import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { clearSession, homeFor, safeNext, saveSession } from "@/lib/session";

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
    return { error: "Devam etmek için aydınlatma metnini onaylayın." };
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
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Kayıt tamamlanamadı." };
  }
  await saveSession(result, result.user.role);
  redirect(safeNext(formData.get("next")) ?? homeFor(result.user.role));
}

export async function logout() {
  const refreshToken = await clearSession();
  if (refreshToken) {
    await apiFetch("/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => undefined);
  }
  redirect("/");
}
