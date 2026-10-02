"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, type CompanyDocumentSummary } from "@/lib/api";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import type { UploadTicket } from "./media";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function companyToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "COMPANY") {
    throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  }
  return (await getAccessToken())!;
}

async function run<T>(fn: () => Promise<T>, fallback: string): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : fallback };
  }
}

/** Belge için kısa süreli yükleme adresi. Tarayıcı dosyayı bu adrese gönderir. */
export async function prepareDocumentUpload(mimeType: string, sizeBytes: number): Promise<Result<UploadTicket>> {
  return run(
    async () =>
      apiFetch<UploadTicket>("/company/documents/uploads", {
        method: "POST",
        token: await companyToken(),
        body: { mimeType, sizeBytes },
      }),
    "Yükleme başlatılamadı, lütfen tekrar dene.",
  );
}

export async function attachDocument(input: {
  type: string;
  key: string;
  fileName: string;
  validUntil?: string;
}): Promise<Result<CompanyDocumentSummary>> {
  const result = await run(
    async () =>
      apiFetch<CompanyDocumentSummary>("/company/documents", {
        method: "POST",
        token: await companyToken(),
        body: input,
      }),
    "Belge kaydedilemedi, lütfen tekrar dene.",
  );
  if (result.ok) revalidatePath("/firma-paneli", "layout");
  return result;
}

export async function removeDocument(documentId: string): Promise<{ error?: string }> {
  const result = await run(
    async () =>
      apiFetch(`/company/documents/${encodeURIComponent(documentId)}`, { method: "DELETE", token: await companyToken() }),
    "Belge silinemedi, lütfen tekrar dene.",
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/firma-paneli", "layout");
  return {};
}
