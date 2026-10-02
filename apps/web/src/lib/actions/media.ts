"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, type RequestMedia } from "@/lib/api";
import { getAccessToken, getCurrentUser } from "@/lib/session";

export type UploadTicket = { key: string; url: string; method: "PUT"; headers: Record<string, string> };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function customerToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") {
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

const base = (requestId: string) => `/requests/${encodeURIComponent(requestId)}/media`;

/** Küçültülmüş dosyalar için yükleme adresleri. Tarayıcı dosyayı doğrudan depoya gönderir. */
export async function prepareMediaUploads(
  requestId: string,
  files: { mimeType: string; sizeBytes: number }[],
): Promise<Result<UploadTicket[]>> {
  return run(async () => {
    const res = await apiFetch<{ uploads: UploadTicket[] }>(`${base(requestId)}/uploads`, {
      method: "POST",
      token: await customerToken(),
      body: { files },
    });
    return res.uploads;
  }, "Yükleme başlatılamadı, lütfen tekrar dene.");
}

export async function attachMedia(
  requestId: string,
  items: { key: string; width?: number; height?: number; durationSec?: number }[],
): Promise<Result<RequestMedia[]>> {
  const result = await run(
    async () => apiFetch<RequestMedia[]>(base(requestId), { method: "POST", token: await customerToken(), body: { items } }),
    "Dosyalar talebe eklenemedi, lütfen tekrar dene.",
  );
  if (result.ok) revalidatePath(`/hesabim/talepler/${requestId}`);
  return result;
}

export async function removeMedia(requestId: string, mediaId: string): Promise<{ error?: string }> {
  const result = await run(
    async () =>
      apiFetch(`${base(requestId)}/${encodeURIComponent(mediaId)}`, { method: "DELETE", token: await customerToken() }),
    "Dosya silinemedi, lütfen tekrar dene.",
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/hesabim/talepler/${requestId}`);
  return {};
}
