"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import type { BankTransfer } from "@/lib/credits";
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

/** Dekont için kısa süreli yükleme adresi */
export async function prepareReceiptUpload(mimeType: string, sizeBytes: number): Promise<Result<UploadTicket>> {
  return run(
    async () =>
      apiFetch<UploadTicket>("/company/credits/transfers/uploads", {
        method: "POST",
        token: await companyToken(),
        body: { mimeType, sizeBytes },
      }),
    "Dekont yüklemesi başlatılamadı, lütfen tekrar dene.",
  );
}

/** "Havale yaptım" bildirimi; yönetim onaylayınca kredi yüklenir */
export async function reportTransfer(input: {
  amountTry: number;
  senderName: string;
  transferDate: string;
  iban: string;
  note?: string;
  receipt?: { key: string; fileName: string };
}): Promise<Result<BankTransfer>> {
  const result = await run(
    async () => apiFetch<BankTransfer>("/company/credits/transfers", { method: "POST", token: await companyToken(), body: input }),
    "Bildirim gönderilemedi, lütfen tekrar dene.",
  );
  if (result.ok) revalidatePath("/firma-paneli/kredi");
  return result;
}

/** Onay bekleyen bildirimi geri alır */
export async function cancelTransfer(transferId: string): Promise<{ error?: string }> {
  const result = await run(
    async () =>
      apiFetch(`/company/credits/transfers/${encodeURIComponent(transferId)}/cancel`, { method: "POST", token: await companyToken() }),
    "Bildirim geri alınamadı, lütfen tekrar dene.",
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/firma-paneli/kredi");
  return {};
}
