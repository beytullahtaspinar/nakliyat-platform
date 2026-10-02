"use server";

import { redirect } from "next/navigation";
import { ApiError, apiFetch, type AuthResponse, type MovingRequest } from "@/lib/api";
import { getAccessToken, getCurrentUser, saveSession, verificationPath } from "@/lib/session";

export type RequestFormState = {
  error?: string;
  /** Formda fotoğraf/video varsa yönlendirme yapılmaz; tarayıcı dosyaları bu talebe yükleyip kendisi yönlendirir */
  createdId?: string;
  /** Hesap doğrulanmadığı için talep taslak kaldı; yüklemeden sonra doğrulama ekranına gidilir */
  needsVerification?: boolean;
};

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const flag = (formData: FormData, name: string) => formData.get(name) === "on";

/** Haritada işaretlenmişse { fromLat, fromLng } gibi; işaret yoksa boş */
function pin(formData: FormData, prefix: "from" | "to") {
  const lat = Number(formData.get(`${prefix}Lat`) || NaN);
  const lng = Number(formData.get(`${prefix}Lng`) || NaN);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { [`${prefix}Lat`]: lat, [`${prefix}Lng`]: lng } : {};
}

function requestBody(formData: FormData) {
  const specialItems = text(formData, "specialItems")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const notes = text(formData, "notes");
  return {
    fromCityCode: text(formData, "fromCityCode"),
    fromDistrict: text(formData, "fromDistrict"),
    fromAddress: text(formData, "fromAddress"),
    fromFloor: Number(formData.get("fromFloor")),
    fromHasElevator: flag(formData, "fromHasElevator"),
    ...pin(formData, "from"),
    toCityCode: text(formData, "toCityCode"),
    toDistrict: text(formData, "toDistrict"),
    toAddress: text(formData, "toAddress"),
    toFloor: Number(formData.get("toFloor")),
    toHasElevator: flag(formData, "toHasElevator"),
    ...pin(formData, "to"),
    homeType: text(formData, "homeType"),
    moveDate: text(formData, "moveDate"),
    isDateFlexible: flag(formData, "isDateFlexible"),
    needsPacking: flag(formData, "needsPacking"),
    needsAssembly: flag(formData, "needsAssembly"),
    needsStorage: flag(formData, "needsStorage"),
    ...(specialItems.length > 0 && { specialItems }),
    ...(notes && { notes }),
  };
}

/** Giriş yapılmamışsa formdaki hesap bölümüyle kayıt olur ya da giriş yapar. */
async function authenticate(formData: FormData): Promise<string> {
  const phone = text(formData, "phone");
  const password = String(formData.get("password") ?? "");
  let result: AuthResponse;
  if (formData.get("account") === "login") {
    result = await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: { phone, password } });
  } else {
    if (!flag(formData, "kvkk")) {
      throw new ApiError(400, "Devam etmek için aydınlatma metnini onaylayın.");
    }
    const email = text(formData, "email");
    result = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: { role: "CUSTOMER", fullName: text(formData, "fullName"), phone, ...(email && { email }), password },
    });
  }
  await saveSession(result, result.user.role);
  if (result.user.role !== "CUSTOMER") {
    throw new ApiError(403, "Firma hesabıyla taşıma talebi oluşturulamaz. Müşteri hesabıyla giriş yapın.");
  }
  return result.accessToken;
}

export async function createRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  let created: MovingRequest;
  try {
    const user = await getCurrentUser();
    if (user && user.role !== "CUSTOMER") {
      return { error: "Firma hesabıyla taşıma talebi oluşturulamaz. Müşteri hesabıyla giriş yapın." };
    }
    const token = user ? (await getAccessToken())! : await authenticate(formData);
    created = await apiFetch<MovingRequest>("/requests", {
      method: "POST",
      token,
      body: requestBody(formData),
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Talep oluşturulamadı, lütfen tekrar deneyin." };
  }
  const needsVerification = created.status === "DRAFT";
  if (formData.get("withMedia") === "1") return { createdId: created.id, needsVerification };
  const done = `/hesabim?yeni=${created.id}`;
  redirect(needsVerification ? verificationPath(done) : done);
}

async function customerToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") {
    throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  }
  return (await getAccessToken())!;
}

export async function acceptQuote(requestId: string, quoteId: string): Promise<RequestFormState> {
  try {
    await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/accept`, {
      method: "POST",
      token: await customerToken(),
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Teklif kabul edilemedi, lütfen tekrar deneyin." };
  }
  redirect(`/hesabim/talepler/${encodeURIComponent(requestId)}?kabul=1`);
}

export async function cancelRequest(requestId: string): Promise<RequestFormState> {
  try {
    await apiFetch(`/requests/${encodeURIComponent(requestId)}/cancel`, {
      method: "POST",
      token: await customerToken(),
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Talep iptal edilemedi, lütfen tekrar deneyin." };
  }
  redirect(`/hesabim/talepler/${encodeURIComponent(requestId)}`);
}
