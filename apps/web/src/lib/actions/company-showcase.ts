"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ApiError, apiFetch, type CompanyShowcase } from "@/lib/api";
import { COMPANY_CACHE_TAG } from "@/lib/reviews";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import type { UploadTicket } from "./media";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type ShowcaseFormState = { error?: string; saved?: boolean };

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

/** Panel ve herkese açık sayfalar (firma sayfası, il sayfalarındaki firma listesi) hemen yenilensin */
function refresh() {
  revalidatePath("/firma-paneli/tanitim");
  updateTag(COMPANY_CACHE_TAG);
}

export async function saveShowcase(_prev: ShowcaseFormState, formData: FormData): Promise<ShowcaseFormState> {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const body = {
    description: text("description"),
    services: formData.getAll("services").map(String),
    foundedYear: text("foundedYear"),
    fleetSize: text("fleetSize"),
    staffSize: text("staffSize"),
  };
  const result = await run(
    async () => apiFetch<CompanyShowcase>("/company/showcase", { method: "PATCH", token: await companyToken(), body }),
    "Tanıtım bilgileri kaydedilemedi.",
  );
  if (!result.ok) return { error: result.error };
  refresh();
  return { saved: true };
}

type FileInfo = { mimeType: string; sizeBytes: number };

/** Logo ya da fotoğraf (büyük + önizleme) için kısa süreli yükleme adresleri */
export async function prepareShowcaseUpload(
  kind: "LOGO" | "PHOTO",
  file: FileInfo,
  thumb?: FileInfo,
): Promise<Result<{ file: UploadTicket; thumb?: UploadTicket }>> {
  return run(
    async () =>
      apiFetch("/company/showcase/uploads", {
        method: "POST",
        token: await companyToken(),
        body: { kind, file, ...(thumb && { thumb }) },
      }),
    "Yükleme başlatılamadı, lütfen tekrar dene.",
  );
}

export async function attachShowcaseMedia(input: {
  kind: "LOGO" | "PHOTO";
  key: string;
  thumbKey?: string;
  width: number;
  height: number;
  caption?: string;
}): Promise<Result<CompanyShowcase>> {
  const result = await run(
    async () =>
      apiFetch<CompanyShowcase>("/company/showcase/media", { method: "POST", token: await companyToken(), body: input }),
    "Görsel kaydedilemedi, lütfen tekrar dene.",
  );
  if (result.ok) refresh();
  return result;
}

export async function saveCaption(mediaId: string, _prev: ShowcaseFormState, formData: FormData): Promise<ShowcaseFormState> {
  const result = await run(
    async () =>
      apiFetch(`/company/showcase/media/${encodeURIComponent(mediaId)}`, {
        method: "PATCH",
        token: await companyToken(),
        body: { caption: String(formData.get("caption") ?? "").trim() },
      }),
    "Açıklama kaydedilemedi.",
  );
  if (!result.ok) return { error: result.error };
  refresh();
  return { saved: true };
}

export async function removeShowcaseMedia(mediaId: string): Promise<{ error?: string }> {
  const result = await run(
    async () =>
      apiFetch(`/company/showcase/media/${encodeURIComponent(mediaId)}`, { method: "DELETE", token: await companyToken() }),
    "Görsel silinemedi, lütfen tekrar dene.",
  );
  if (!result.ok) return { error: result.error };
  refresh();
  return {};
}
