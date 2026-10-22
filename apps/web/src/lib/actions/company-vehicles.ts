"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, type CompanyVehicleSummary, type VehicleFileKind } from "@/lib/api";
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

/** Ruhsat ya da fotoğraf için kısa süreli yükleme adresi */
export async function prepareVehicleUpload(
  kind: VehicleFileKind,
  mimeType: string,
  sizeBytes: number,
): Promise<Result<UploadTicket>> {
  return run(
    async () =>
      apiFetch<UploadTicket>("/company/vehicles/uploads", {
        method: "POST",
        token: await companyToken(),
        body: { kind, mimeType, sizeBytes },
      }),
    "Yükleme başlatılamadı, lütfen tekrar dene.",
  );
}

export type VehicleInput = {
  plate?: string;
  type?: string;
  authorization?: string;
  files?: Partial<Record<VehicleFileKind, { key: string; fileName: string }>>;
};

/** Yeni araç (vehicleId yok) ya da onaylanmamış aracın düzeltilmesi */
export async function saveVehicle(vehicleId: string | null, input: VehicleInput): Promise<Result<CompanyVehicleSummary>> {
  const result = await run(
    async () =>
      apiFetch<CompanyVehicleSummary>(vehicleId ? `/company/vehicles/${encodeURIComponent(vehicleId)}` : "/company/vehicles", {
        method: vehicleId ? "PATCH" : "POST",
        token: await companyToken(),
        body: input,
      }),
    "Araç kaydedilemedi, lütfen tekrar dene.",
  );
  if (result.ok) revalidatePath("/firma-paneli", "layout");
  return result;
}

export async function removeVehicle(vehicleId: string): Promise<{ error?: string }> {
  const result = await run(
    async () =>
      apiFetch(`/company/vehicles/${encodeURIComponent(vehicleId)}`, { method: "DELETE", token: await companyToken() }),
    "Araç silinemedi, lütfen tekrar dene.",
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/firma-paneli", "layout");
  return {};
}
