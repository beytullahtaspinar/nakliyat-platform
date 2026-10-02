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
    /** API'nin verdiği istek kimliği; destek ve log araması için */
    readonly requestId?: string,
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
  if (!res.ok) {
    const requestId = (data as { requestId?: unknown } | null)?.requestId;
    const id = typeof requestId === "string" ? requestId : undefined;
    throw new ApiError(res.status, errorMessage(res.status, data, id), id);
  }
  return data as T;
}

/** API hata gövdesinden kullanıcıya gösterilebilir Türkçe mesajı çıkarır. */
function errorMessage(status: number, data: unknown, requestId?: string): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === "string" && status < 500) return message;
  if (Array.isArray(message)) return "Formdaki bilgileri kontrol edin.";
  if (status === 429) return "Çok fazla deneme yapıldı, bir dakika sonra tekrar deneyin.";
  const code = requestId ? ` (hata kodu: ${requestId})` : "";
  return `Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.${code}`;
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
  emailVerified: boolean;
  /** Talep yayını, teklif verme ve teklif kabulü için gereken doğrulamalar tamam */
  verified: boolean;
};

export type ContactVerification = {
  email: string | null;
  emailVerified: boolean;
  /** Geçerli kodun gönderildiği e-posta */
  emailCodeSentTo: string | null;
  emailResendAt: string | null;
  phone: string;
  phoneVerified: boolean;
  /** SMS/WhatsApp sağlayıcısı bağlıysa telefon doğrulaması zorunlu */
  phoneRequired: boolean;
  phoneChannel: "sms" | "whatsapp" | null;
  phoneCodeSent: boolean;
  phoneResendAt: string | null;
  complete: boolean;
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

export type RequestMedia = {
  id: string;
  type: "PHOTO" | "VIDEO";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  /** Kısa süreli (1-2 saat) imzalı görüntüleme adresi */
  url: string;
  createdAt: string;
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
  media: RequestMedia[];
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

// ─── Firma paneli ──────────────────────────────────────────────

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type CompanyProfile = {
  id: string;
  legalName: string;
  displayName: string;
  taxNumber: string;
  k3LicenseNumber: string | null;
  description: string | null;
  cityCode: string;
  cityName: string | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  serviceCityCodes: string[];
};

/** Firmaya gösterilen talep: müşteri adı ve açık adres yok */
export type CompanyRequestView = {
  id: string;
  status: RequestStatus;
  fromCityCode: string;
  fromCityName: string | null;
  fromDistrictName: string | null;
  fromFloor: number;
  fromHasElevator: boolean;
  toCityCode: string;
  toCityName: string | null;
  toDistrictName: string | null;
  toFloor: number;
  toHasElevator: boolean;
  homeType: string;
  moveDate: string;
  isDateFlexible: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
  needsStorage: boolean;
  specialItems: string[];
  notes: string | null;
  estimatedVolumeM3: number | null;
  estimatedCrew: number | null;
  estimatedHours: number | null;
  distanceKm: number | null;
  expiresAt: string;
  createdAt: string;
};

export type OwnQuote = Omit<CustomerQuote, "company" | "isExpired"> & { createdAt: string };

export type CompanyRequest = CompanyRequestView & { quoteCount: number; myQuote: OwnQuote | null };

/** Firma talep ayrıntısı: müşterinin eklediği fotoğraf ve videolarla */
export type CompanyRequestDetail = CompanyRequest & { media: RequestMedia[] };

export type CompanyQuote = OwnQuote & { request: CompanyRequestView };

type BookingPlace = {
  cityName: string | null;
  districtName: string | null;
  address: string;
  floor: number;
  hasElevator: boolean;
};

export type CompanyBooking = {
  id: string;
  requestId: string;
  status: CustomerBooking["status"];
  scheduledAt: string;
  priceTry: string;
  request: { id: string; from: BookingPlace; to: BookingPlace; homeType: string; moveDate: string; notes: string | null };
  customer: { fullName: string; phone: string };
};

// ─── Yönetim ───────────────────────────────────────────────────

export type AdminSummary = {
  companies: { pending: number; verified: number; rejected: number };
  requests: { open: number; booked: number; total: number };
  users: { customers: number; companies: number; total: number };
  bookings: { scheduled: number };
  documents: { pending: number };
};

type CompanyOwner = { fullName: string; phone: string; email: string | null };

export type AdminCompany = CompanyProfile & {
  serviceCities: { code: string; name: string | null }[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: CompanyOwner;
};

export type CompanyDocument = {
  id: string;
  type: "K3_LICENSE" | "TAX_CERTIFICATE" | "TRADE_REGISTRY" | "INSURANCE" | "OTHER";
  status: VerificationStatus;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** YYYY-AA-GG */
  validUntil: string | null;
  expired: boolean;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  /** Kısa süreli imzalı görüntüleme adresi */
  url: string;
};

export type DocumentRequirement = {
  type: CompanyDocument["type"];
  state: "VERIFIED" | "PENDING" | "REJECTED" | "EXPIRED" | "MISSING";
};

/** GET /admin/documents: belge ve ait olduğu firma */
export type AdminDocument = CompanyDocument & {
  company: { id: string; displayName: string; legalName: string; verificationStatus: VerificationStatus };
  /** Aynı türden onaylı eski belgesi var: onaylı firmanın güncellemesi */
  replacesVerified: boolean;
};

/** GET /company/documents: belgeler ve zorunlu belgelerin durumu */
export type CompanyDocumentSummary = { documents: CompanyDocument[]; requirements: DocumentRequirement[] };

export type AdminCompanyDetail = AdminCompany &
  CompanyDocumentSummary & {
  owner: CompanyOwner & { id: string; createdAt: string };
  quoteCount: number;
  bookingCount: number;
  history: {
    action: string;
    details: {
      from?: VerificationStatus;
      to?: VerificationStatus;
      note?: string | null;
      type?: CompanyDocument["type"];
    } | null;
    createdAt: string;
    actor: { fullName: string };
  }[];
};

export type AdminRequest = MovingRequest & {
  customer: { id: string; fullName: string; phone: string };
};

export type AdminRequestDetail = MovingRequestDetail & {
  customer: { id: string; fullName: string; phone: string; email: string | null };
  quotes: (Omit<CustomerQuote, "company" | "isExpired"> & {
    createdAt: string;
    company: { id: string; displayName: string; verificationStatus: VerificationStatus };
  })[];
  booking: {
    id: string;
    status: CustomerBooking["status"];
    scheduledAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
  } | null;
};

export type AdminUser = {
  id: string;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED";
  fullName: string;
  phone: string;
  email: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  company: { id: string; displayName: string; verificationStatus: VerificationStatus } | null;
  requestCount: number;
};

export type AdminUserDetail = AdminUser & {
  history: { action: string; details: unknown; createdAt: string; actor: { fullName: string } }[];
};

export type NotificationChannel = "EMAIL" | "SMS" | "PUSH";

export type NotificationPreferences = {
  email: string | null;
  channels: NotificationChannel[];
  items: {
    type: string;
    label: string;
    description: string;
    channels: Partial<Record<NotificationChannel, boolean>>;
  }[];
};
