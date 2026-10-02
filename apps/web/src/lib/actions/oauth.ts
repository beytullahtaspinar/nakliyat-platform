"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch, type AuthResponse } from "@/lib/api";
import { SIGNUP_COOKIE } from "@/lib/oauth";
import { homeFor, safeNext, saveSession, verificationPath } from "@/lib/session";

export type CompleteFormState = { error?: string };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Google / Apple ile gelen yeni kişi: telefon ve rol alınıp hesap açılır */
export async function completeOAuthSignup(_prev: CompleteFormState, formData: FormData): Promise<CompleteFormState> {
  if (formData.get("kvkk") !== "on") return { error: "Devam etmek için aydınlatma metnini onaylayın." };
  const store = await cookies();
  const signupToken = store.get(SIGNUP_COOKIE)?.value;
  if (!signupToken) return { error: "Kayıt süresi doldu. Google veya Apple ile yeniden devam et." };

  let result: AuthResponse;
  try {
    result = await apiFetch<AuthResponse>("/auth/oauth/complete", {
      method: "POST",
      body: {
        signupToken,
        role: formData.get("role") === "COMPANY" ? "COMPANY" : "CUSTOMER",
        fullName: text(formData, "fullName"),
        phone: text(formData, "phone"),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Kayıt tamamlanamadı." };
  }
  store.delete(SIGNUP_COOKIE);
  await saveSession(result, result.user.role);
  const target = safeNext(formData.get("next")) ?? homeFor(result.user.role);
  redirect(result.user.verified ? target : verificationPath(target));
}
