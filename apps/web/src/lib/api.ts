/**
 * API istemcisi. Yalnızca sunucu tarafında (Server Component, Server Action, proxy) kullanılır;
 * erişim anahtarı tarayıcıya hiç inmez.
 */
const API_ORIGIN =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://api.evdenevenakliyat.app";
export const API_BASE = `${API_ORIGIN.replace(/\/$/, "")}/v1`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(path: string, { method = "GET", body, token }: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "Sunucuya şu an ulaşılamıyor, lütfen biraz sonra tekrar deneyin.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return data as T;
}

/** API hata gövdesinden kullanıcıya gösterilebilir Türkçe mesajı çıkarır. */
function errorMessage(status: number, data: unknown): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === "string" && status < 500) return message;
  if (Array.isArray(message)) return "Formdaki bilgileri kontrol edin.";
  if (status === 429) return "Çok fazla deneme yapıldı, bir dakika sonra tekrar deneyin.";
  return "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.";
}

// ─── API yanıt tipleri ─────────────────────────────────────────

export type UserRole = "CUSTOMER" | "COMPANY" | "ADMIN";

export type AuthUser = {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
};

export type AuthTokens = { accessToken: string; refreshToken: string };
export type AuthResponse = AuthTokens & { user: AuthUser };

export type RequestStatus = "DRAFT" | "OPEN" | "BOOKED" | "COMPLETED" | "CANCELLED" | "EXPIRED";

export type MovingRequest = {
  id: string;
  status: RequestStatus;
  fromCityName: string | null;
  fromDistrictName: string | null;
  toCityName: string | null;
  toDistrictName: string | null;
  homeType: string;
  moveDate: string;
  estimatedVolumeM3: number | null;
  distanceKm: number | null;
  expiresAt: string;
  createdAt: string;
  quoteCount: number;
};

export type MovingRequestDetail = MovingRequest & {
  fromAddress: string;
  fromFloor: number;
  fromHasElevator: boolean;
  toAddress: string;
  toFloor: number;
  toHasElevator: boolean;
  isDateFlexible: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
  needsStorage: boolean;
  specialItems: string[];
  notes: string | null;
  estimatedCrew: number | null;
  estimatedHours: number | null;
};

export type PublicCompany = {
  id: string;
  displayName: string;
  logoUrl: string | null;
  cityName: string | null;
  verified: boolean;
  ratingAverage: string;
  ratingCount: number;
  completedJobs: number;
};

export type CompanyContact = PublicCompany & { contactName: string; contactPhone: string };

export type QuoteStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type VehicleType = "PANELVAN" | "KAMYONET" | "KAMYON" | "TIR";

export type CustomerQuote = {
  id: string;
  status: QuoteStatus;
  /** TL, ondalıklı metin: "12500" veya "12500.5" */
  priceTry: string;
  includesPacking: boolean;
  includesAssembly: boolean;
  includesInsurance: boolean;
  crewSize: number;
  vehicleType: VehicleType;
  message: string | null;
  validUntil: string;
  isExpired: boolean;
  company: PublicCompany;
};

export type CustomerBooking = {
  id: string;
  requestId: string;
  quoteId: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  priceTry: string;
  company: CompanyContact;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };
