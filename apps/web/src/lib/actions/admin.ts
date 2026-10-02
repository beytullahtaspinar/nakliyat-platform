"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { companyProfileBody } from "@/lib/company-form";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import { IMPERSONATION_COOKIE, IMPERSONATION_PATH } from "@/lib/session-cookies";

export type AdminActionState = { error?: string; notice?: string };

async function adminToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  }
  return (await getAccessToken())!;
}

const failure = (err: unknown, fallback: string): AdminActionState => ({
  error: err instanceof ApiError ? err.message : fallback,
});

export async function verifyCompany(companyId: string): Promise<AdminActionState> {
  try {
    await apiFetch(`/admin/companies/${encodeURIComponent(companyId)}/verify`, {
      method: "POST",
      token: await adminToken(),
    });
  } catch (err) {
    return failure(err, "Firma onaylanamadı.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Firma onaylandı; artık teklif verebilir." };
}

export async function rejectCompany(
  companyId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Firmanın neyi düzelteceğini anlayacağı bir gerekçe yazın." };
  try {
    await apiFetch(`/admin/companies/${encodeURIComponent(companyId)}/reject`, {
      method: "POST",
      token: await adminToken(),
      body: { reason },
    });
  } catch (err) {
    return failure(err, "Firma reddedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Firma reddedildi; gerekçe firma panelinde gösterilir." };
}

export async function approveDocument(companyId: string, documentId: string): Promise<AdminActionState> {
  try {
    await apiFetch(
      `/admin/companies/${encodeURIComponent(companyId)}/documents/${encodeURIComponent(documentId)}/approve`,
      { method: "POST", token: await adminToken() },
    );
  } catch (err) {
    return failure(err, "Belge onaylanamadı.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Belge onaylandı." };
}

export async function rejectDocument(
  companyId: string,
  documentId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Firmanın neyi düzelteceğini anlayacağı bir gerekçe yazın." };
  try {
    await apiFetch(
      `/admin/companies/${encodeURIComponent(companyId)}/documents/${encodeURIComponent(documentId)}/reject`,
      { method: "POST", token: await adminToken(), body: { reason } },
    );
  } catch (err) {
    return failure(err, "Belge reddedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Belge reddedildi; gerekçe firma panelinde gösterilir." };
}

export async function updateCompany(
  companyId: string,
  _prev: AdminActionState & { saved?: boolean },
  formData: FormData,
): Promise<AdminActionState & { saved?: boolean }> {
  try {
    await apiFetch(`/admin/companies/${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      token: await adminToken(),
      body: companyProfileBody(formData, false),
    });
  } catch (err) {
    return failure(err, "Firma bilgileri kaydedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { saved: true };
}

export async function updateUser(userId: string, _prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      token: await adminToken(),
      body: { fullName: text("fullName"), phone: text("phone"), email: text("email"), status: text("status") },
    });
  } catch (err) {
    return failure(err, "Kullanıcı bilgileri kaydedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Kaydedildi." };
}

export async function setUserPassword(
  userId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}/password`, {
      method: "POST",
      token: await adminToken(),
      body: { password },
    });
  } catch (err) {
    return failure(err, "Şifre değiştirilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Yeni şifre kaydedildi; kullanıcının açık oturumları kapatıldı. Şifreyi kullanıcıya güvenli bir yoldan ilet." };
}

export async function deleteUser(userId: string): Promise<AdminActionState> {
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", token: await adminToken() });
  } catch (err) {
    return failure(err, "Hesap silinemedi.");
  }
  revalidatePath("/yonetim", "layout");
  redirect("/yonetim/kullanicilar?silindi=1");
}

/** Firma panelini firmanın gözünden açar; yöneticinin kendi oturumu olduğu gibi kalır. */
export async function impersonateCompany(companyId: string): Promise<AdminActionState> {
  let result: { accessToken: string; expiresIn: number };
  try {
    result = await apiFetch(`/admin/companies/${encodeURIComponent(companyId)}/impersonate`, {
      method: "POST",
      token: await adminToken(),
    });
  } catch (err) {
    return failure(err, "Firma paneline geçilemedi.");
  }
  (await cookies()).set(IMPERSONATION_COOKIE, result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: IMPERSONATION_PATH,
    // Anahtarın süresi dolmadan çerez düşer; yönetici kendi oturumuna döner
    maxAge: result.expiresIn - 60,
  });
  redirect(IMPERSONATION_PATH);
}

/** Firma panelinden yönetime döner. */
export async function stopImpersonating(formData: FormData) {
  (await cookies()).delete({ name: IMPERSONATION_COOKIE, path: IMPERSONATION_PATH });
  const companyId = String(formData.get("companyId") ?? "");
  redirect(/^[\w-]+$/.test(companyId) ? `/yonetim/firmalar/${companyId}` : "/yonetim/firmalar");
}
