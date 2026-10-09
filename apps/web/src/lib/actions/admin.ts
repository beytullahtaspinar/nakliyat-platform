"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRICING_SETTING_SPECS, type PricingSettingKey } from "@nakliyat/pricing";
import { ApiError, apiFetch } from "@/lib/api";
import { companyProfileBody } from "@/lib/company-form";
import { CREDIT_SETTING_FIELDS, MAX_BANK_ACCOUNTS, parseTryAmount, type BankAccount, type CreditSettings } from "@/lib/credits";
import { PRICING_CACHE_TAG } from "@/lib/pricing";
import { COMPANY_CACHE_TAG } from "@/lib/reviews";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import {
  CUSTOMER_IMPERSONATION_COOKIE,
  CUSTOMER_IMPERSONATION_PATH,
  IMPERSONATION_COOKIE,
  IMPERSONATION_PATH,
} from "@/lib/session-cookies";

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
  // Ad ya da tanıtım yazısı herkese açık firma sayfasında da hemen değişsin
  updateTag(COMPANY_CACHE_TAG);
  return { saved: true };
}

/** Firma görselini herkese açık sayfadan kaldırır (gerekçe firma panelinde görünür) ya da geri yayınlar */
export async function setCompanyMediaHidden(
  companyId: string,
  mediaId: string,
  hide: boolean,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (hide && reason.length < 3) return { error: "Firmanın anlayacağı kısa bir gerekçe yazın." };
  const base = `/admin/companies/${encodeURIComponent(companyId)}/media/${encodeURIComponent(mediaId)}`;
  try {
    await apiFetch(`${base}/${hide ? "hide" : "unhide"}`, {
      method: "POST",
      token: await adminToken(),
      ...(hide && { body: { reason } }),
    });
  } catch (err) {
    return failure(err, "Görsel güncellenemedi.");
  }
  revalidatePath("/yonetim", "layout");
  updateTag(COMPANY_CACHE_TAG);
  return { notice: hide ? "Görsel sayfadan kaldırıldı." : "Görsel yeniden yayında." };
}

/** Onaylı firmanın görünen ad değişikliği: onayda yeni ad hemen yayına girer */
export async function approveNameChange(changeId: string): Promise<AdminActionState> {
  try {
    await apiFetch(`/admin/name-changes/${encodeURIComponent(changeId)}/approve`, {
      method: "POST",
      token: await adminToken(),
    });
  } catch (err) {
    return failure(err, "Ad değişikliği onaylanamadı.");
  }
  revalidatePath("/yonetim", "layout");
  updateTag(COMPANY_CACHE_TAG);
  return { notice: "Yeni ad yayında." };
}

export async function rejectNameChange(
  changeId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Firmanın anlayacağı bir gerekçe yazın." };
  try {
    await apiFetch(`/admin/name-changes/${encodeURIComponent(changeId)}/reject`, {
      method: "POST",
      token: await adminToken(),
      body: { reason },
    });
  } catch (err) {
    return failure(err, "Ad değişikliği reddedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Reddedildi; firma eski adıyla görünmeye devam ediyor." };
}

/** Yönetimden açılan hesabın ortak alanları (müşteri ya da firma yetkilisi) */
function accountBody(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    password: String(formData.get("password") ?? ""),
    markVerified: formData.get("markVerified") === "on",
  };
}

/** Müşteri hesabı açar ve yeni hesabın sayfasına gider */
export async function createCustomer(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const body = accountBody(formData);
  if (body.password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  let id: string;
  try {
    ({ id } = await apiFetch<{ id: string }>("/admin/users", { method: "POST", token: await adminToken(), body }));
  } catch (err) {
    return failure(err, "Müşteri hesabı açılamadı.");
  }
  revalidatePath("/yonetim", "layout");
  redirect(`/yonetim/kullanicilar/${id}?yeni=1`);
}

/** Firmayı yetkilisinin hesabıyla birlikte açar ve firmanın inceleme sayfasına gider */
export async function createCompany(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const account = accountBody(formData);
  if (account.password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  let id: string;
  try {
    ({ id } = await apiFetch<{ id: string }>("/admin/companies", {
      method: "POST",
      token: await adminToken(),
      body: { ...companyProfileBody(formData, true), ...account },
    }));
  } catch (err) {
    return failure(err, "Firma açılamadı.");
  }
  revalidatePath("/yonetim", "layout");
  redirect(`/yonetim/firmalar/${id}?yeni=1`);
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

/** Müşterinin hesabını müşterinin gözünden açar; yöneticinin kendi oturumu olduğu gibi kalır. */
export async function impersonateCustomer(userId: string): Promise<AdminActionState> {
  let result: { accessToken: string; expiresIn: number };
  try {
    result = await apiFetch(`/admin/users/${encodeURIComponent(userId)}/impersonate`, {
      method: "POST",
      token: await adminToken(),
    });
  } catch (err) {
    return failure(err, "Müşteri hesabına geçilemedi.");
  }
  (await cookies()).set(CUSTOMER_IMPERSONATION_COOKIE, result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CUSTOMER_IMPERSONATION_PATH,
    maxAge: result.expiresIn - 60,
  });
  redirect(CUSTOMER_IMPERSONATION_PATH);
}

/** Müşteri hesabından yönetime döner. */
export async function stopImpersonatingCustomer(formData: FormData) {
  (await cookies()).delete({ name: CUSTOMER_IMPERSONATION_COOKIE, path: CUSTOMER_IMPERSONATION_PATH });
  const userId = String(formData.get("userId") ?? "");
  redirect(/^[\w-]+$/.test(userId) ? `/yonetim/kullanicilar/${userId}` : "/yonetim/kullanicilar");
}

/** Fiyat hesaplayıcı katsayıları; kaydedilince herkese açık hesaplama sayfası hemen yenilenir */
export async function updatePricing(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const body: Partial<Record<PricingSettingKey, number>> = {};
  for (const [key, spec] of Object.entries(PRICING_SETTING_SPECS) as [PricingSettingKey, (typeof PRICING_SETTING_SPECS)[PricingSettingKey]][]) {
    const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < spec.min || value > spec.max) {
      return { error: `${spec.label} ${spec.min.toLocaleString("tr-TR")} ile ${spec.max.toLocaleString("tr-TR")} arasında olmalı.` };
    }
    body[key] = value;
  }
  try {
    await apiFetch("/admin/pricing", { method: "PATCH", token: await adminToken(), body });
  } catch (err) {
    return failure(err, "Katsayılar kaydedilemedi.");
  }
  updateTag(PRICING_CACHE_TAG);
  revalidatePath("/yonetim/fiyat-hesaplama");
  return { notice: "Katsayılar kaydedildi; fiyat hesaplama sayfası güncellendi." };
}

/** Kredi ayarları; sistemi açma/kapama da buradan */
export async function updateCreditSettings(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const body: Partial<CreditSettings> = { enabled: formData.get("enabled") === "on", cardEnabled: formData.get("cardEnabled") === "on" };
  for (const field of CREDIT_SETTING_FIELDS) {
    const raw = String(formData.get(field.key) ?? "").trim().replace(",", ".");
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < field.min || value > field.max || (!field.decimal && !Number.isInteger(value))) {
      return {
        error: `${field.label} ${field.min.toLocaleString("tr-TR")} ile ${field.max.toLocaleString("tr-TR")} arasında ${field.decimal ? "bir sayı" : "tam sayı"} olmalı.`,
      };
    }
    body[field.key] = value;
  }
  const accounts: BankAccount[] = [];
  for (let i = 0; i < MAX_BANK_ACCOUNTS; i++) {
    const bank = String(formData.get(`bank_${i}`) ?? "").trim();
    const holder = String(formData.get(`holder_${i}`) ?? "").trim();
    const iban = String(formData.get(`iban_${i}`) ?? "").replace(/\s+/g, "").toUpperCase();
    if (!bank && !holder && !iban) continue;
    if (!bank || !holder || !iban) return { error: `${i + 1}. hesapta banka, hesap sahibi ve IBAN birlikte yazılmalı (hesabı kaldırmak için üçünü de boşalt).` };
    accounts.push({ bank, holder, iban });
  }
  body.bankAccounts = accounts;
  try {
    await apiFetch("/admin/credits/settings", { method: "PATCH", token: await adminToken(), body });
  } catch (err) {
    return failure(err, "Kredi ayarları kaydedilemedi.");
  }
  revalidatePath("/yonetim/krediler", "layout");
  revalidatePath("/firma-paneli", "layout");
  return { notice: body.enabled ? "Kaydedildi. Kredi sistemi açık: teklifler kredi düşüyor." : "Kaydedildi. Kredi sistemi kapalı: teklif vermek ücretsiz." };
}

/** Havale bildirimini onaylar; hesaba geçen tutar farklıysa düzeltilmiş tutarla */
export async function approveTransfer(transferId: string, _prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const amountTry = parseTryAmount(String(formData.get("amountTry") ?? ""));
  if (!Number.isFinite(amountTry) || amountTry <= 0) return { error: "Hesaba geçen tutarı yaz (ör. 1500 ya da 1.500,50)." };
  let credits: number;
  try {
    ({ credits } = await apiFetch<{ credits: number }>(`/admin/credits/transfers/${encodeURIComponent(transferId)}/approve`, {
      method: "POST",
      token: await adminToken(),
      body: { amountTry },
    }));
  } catch (err) {
    return failure(err, "Bildirim onaylanamadı.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: `Onaylandı: ${credits.toLocaleString("tr-TR")} kredi yüklendi.` };
}

export async function rejectTransfer(transferId: string, _prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Firmaya gösterilecek gerekçeyi yaz (en az 3 karakter)." };
  try {
    await apiFetch(`/admin/credits/transfers/${encodeURIComponent(transferId)}/reject`, { method: "POST", token: await adminToken(), body: { reason } });
  } catch (err) {
    return failure(err, "Bildirim reddedilemedi.");
  }
  revalidatePath("/yonetim", "layout");
  return { notice: "Reddedildi; firmaya gerekçeyle haber verildi." };
}

/** Firmaya elle kredi ekleme (artı) ya da düşme (eksi); gerekçe firmanın hareket listesinde görünür */
export async function adjustCredits(companyId: string, _prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isInteger(amount) || amount === 0) return { error: "Miktar 0 dışında bir tam sayı olmalı (düşmek için eksi yaz)." };
  if (note.length < 3) return { error: "Gerekçe yaz (en az 3 karakter)." };
  let balance: number;
  try {
    ({ balance } = await apiFetch<{ balance: number }>(`/admin/companies/${encodeURIComponent(companyId)}/credits`, {
      method: "POST",
      token: await adminToken(),
      body: { amount, note },
    }));
  } catch (err) {
    return failure(err, "Kredi işlenemedi.");
  }
  revalidatePath(`/yonetim/firmalar/${companyId}`);
  revalidatePath("/yonetim/krediler");
  return { notice: `${amount > 0 ? "Eklendi" : "Düşüldü"}. Yeni bakiye: ${balance.toLocaleString("tr-TR")} kredi.` };
}
