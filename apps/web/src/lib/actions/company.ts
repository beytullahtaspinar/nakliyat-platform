"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { companyProfileBody } from "@/lib/company-form";
import { getAccessToken, getCurrentUser } from "@/lib/session";

export type CompanyFormState = { error?: string; saved?: boolean; notice?: string };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const flag = (formData: FormData, name: string) => formData.get(name) === "on";

async function companyToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "COMPANY") {
    throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  }
  return (await getAccessToken())!;
}

const failure = (err: unknown, fallback: string): CompanyFormState => ({
  error: err instanceof ApiError ? err.message : fallback,
});

export async function saveCompanyProfile(
  isNew: boolean,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const body = companyProfileBody(formData, isNew);
  try {
    await apiFetch("/company/profile", { method: isNew ? "POST" : "PATCH", token: await companyToken(), body });
  } catch (err) {
    return failure(err, "Firma bilgileri kaydedilemedi.");
  }
  revalidatePath("/firma-paneli", "layout");
  if (isNew) redirect("/firma-paneli");
  return { saved: true };
}

export async function submitQuote(
  requestId: string,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  // Teklif kimliği formdan gelir: ilk gönderimden sonra form aynı kalır, durum mesajı kaybolmaz.
  const quoteId = text(formData, "quoteId") || null;
  const validUntil = text(formData, "validUntil");
  const message = text(formData, "message");
  const body = {
    priceTry: Number(text(formData, "priceTry")),
    vehicleType: text(formData, "vehicleType"),
    crewSize: Number(formData.get("crewSize")),
    includesPacking: flag(formData, "includesPacking"),
    includesAssembly: flag(formData, "includesAssembly"),
    includesInsurance: flag(formData, "includesInsurance"),
    ...(validUntil && { validUntil }),
    ...(message || quoteId ? { message } : {}),
  };
  if (!Number.isFinite(body.priceTry) || body.priceTry <= 0) {
    return { error: "Geçerli bir fiyat girin." };
  }
  try {
    const token = await companyToken();
    if (quoteId) {
      await apiFetch(`/company/quotes/${encodeURIComponent(quoteId)}`, { method: "PATCH", token, body });
    } else {
      await apiFetch(`/company/requests/${encodeURIComponent(requestId)}/quotes`, { method: "POST", token, body });
    }
  } catch (err) {
    return failure(err, "Teklif gönderilemedi.");
  }
  revalidatePath("/firma-paneli", "layout");
  return { notice: quoteId ? "Teklifin güncellendi." : "Teklifin müşteriye gönderildi." };
}

export async function withdrawQuote(quoteId: string): Promise<CompanyFormState> {
  try {
    await apiFetch(`/company/quotes/${encodeURIComponent(quoteId)}/withdraw`, {
      method: "POST",
      token: await companyToken(),
    });
  } catch (err) {
    return failure(err, "Teklif geri çekilemedi.");
  }
  revalidatePath("/firma-paneli", "layout");
  return {};
}
