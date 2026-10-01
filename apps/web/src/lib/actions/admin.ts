"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken, getCurrentUser } from "@/lib/session";

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
