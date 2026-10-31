/**
 * API istemcisi. Yalnızca sunucu tarafında (Server Component, Server Action, proxy) kullanılır;
 * erişim anahtarı tarayıcıya hiç inmez.
 */
import type { RequestCredit } from "./credits";

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
  /** Herkese açık sayfalar için: yanıt bu kadar saniye önbellekte tutulur (varsayılan: önbellek yok) */
  revalidate?: number;
  /** Önbellek etiketleri: sunucu eylemi updateTag ile süresini hemen bitirebilir */
  tags?: string[];
};

export async function apiFetch<T>(path: string, { method = "GET", body, token, revalidate, tags }: ApiOptions = {}): Promise<T> {
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
      ...(revalidate && !token ? { next: { revalidate, tags } } : { cache: "no-store" as const }),
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
  /** Şifreyle giriş yapabiliyor; yalnızca Google/Apple ile açılan hesaplarda false */
  hasPassword: boolean;
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
  /** Haritadaki iki işaret arası kamyon yolu; işaret yoksa ya da hesaplanamadıysa null */
  routeKm: number | null;
  routeMinutes: number | null;
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
  fromLat: number | null;
  fromLng: number | null;
  toLat: number | null;
  toLng: number | null;
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
  /** Teklif listesinde ve firma sayfasında gelir (bkz. lib/badges.ts) */
  badges?: BadgeCode[];
  /** Teklif listesinde: firmanın en yeni yazılı yorumu, kısaltılmış (yoksa null) */
  latestReview?: ReviewExcerpt | null;
};

/** Yorum alıntısı: teklif kartında firma satırının altında */
export type ReviewExcerpt = {
  rating: number;
  excerpt: string;
  authorName: string;
  route: string;
  moveDate: string;
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

/** Müşterinin ve firmanın kendi ekranında gördüğü değerlendirme */
export type OwnReview = {
  id: string;
  rating: number;
  comment: string | null;
  companyReply: string | null;
  companyReplyAt: string | null;
  /** Yönetici gizlediyse false; gizli yorum firma sayfasında ve ortalamada yok */
  isPublished: boolean;
  hiddenReason: string | null;
  /** Müşterinin son düzenlemesi; null ise hiç düzenlenmedi */
  editedAt: string | null;
  createdAt: string;
  /** Müşteri yorumu firmanın yanıtından sonra düzenledi: firma yanıtını güncelleyebilir */
  replyOutdated: boolean;
};

/** İşi kimin kapattığı: SYSTEM = süre dolunca kendiliğinden, ADMIN = itiraz kararı */
export type BookingActor = "CUSTOMER" | "COMPANY" | "SYSTEM" | "ADMIN";

/** "Taşınma yapılmadı" itirazı ve yönetimin kararı */
export type BookingDispute = {
  completedBy: BookingActor | null;
  disputedAt: string | null;
  disputedBy: BookingActor | null;
  disputeReason: string | null;
  disputeResolvedAt: string | null;
  disputeResolution: string | null;
};

/** Değerlendirme, "iş tamamlandı", "itiraz et" ve "işi iptal et" düğmeleri için iş alanları */
type BookingReviewState = BookingDispute & {
  completedAt: string | null;
  /** Planlanmış, itirazsız ve taşınma günü gelmiş: tamamlandı olarak işaretlenebilir */
  canComplete: boolean;
  /** Planlanmış, itirazsız ve taşınma günü geçmemiş: gerekçeyle iptal edilebilir */
  canCancel: boolean;
  /** Taşınma günü geldi, iş tamamlanmadı: "taşınma yapılmadı" diye itiraz edilebilir */
  canDispute: boolean;
  /** İtiraz olmazsa işin kendiliğinden tamamlanacağı gün ("2026-10-22"); planlanmış ve itirazsız işte dolu */
  autoCompleteOn: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  review: OwnReview | null;
};

export type CustomerBooking = BookingReviewState & {
  id: string;
  requestId: string;
  quoteId: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  priceTry: string;
  company: CompanyContact;
};

/** "5" → kaç yorum (yayındakiler) */
export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

/** GET /companies/:id: herkese açık firma profili */
export type PublicCompanyPhoto = {
  id: string;
  /** Sitedeki kalıcı adres: /medya/firmalar/<firmaId>/<dosya> */
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  caption: string | null;
};

export type PublicCompanyProfile = PublicCompany & {
  /** Vergi levhasındaki resmi unvan: görünen ad değişse de müşteri kiminle çalıştığını görür */
  legalName: string;
  cityCode: string;
  description: string | null;
  services: string[];
  foundedYear: number | null;
  fleetSize: number | null;
  staffSize: number | null;
  photos: PublicCompanyPhoto[];
  /** Yorumu var ya da tanıtımı yeterince dolu: arama motoruna açık */
  indexable: boolean;
  serviceCities: { code: string; name: string | null }[];
  verifiedAt: string | null;
  memberSince: string;
  updatedAt: string;
  ratingDistribution: RatingDistribution;
};

/** GET /companies/:id/reviews: müşteri adı kısaltılmış ("Ayşe Y.") */
export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  /** "İzmir → Ankara" ya da "İzmir içi" */
  route: string;
  /** Taşınma günü: "doğrulanmış taşıma" rozetinde ay ve yıl gösterilir */
  moveDate: string;
  createdAt: string;
  editedAt: string | null;
  companyReply: string | null;
  companyReplyAt: string | null;
};

/** GET /reviews/latest: sitedeki en yeni yazılı yorumlar (ana sayfa, il sayfaları) */
export type LatestReview = PublicReview & {
  /** Çıkış ve varış illeri */
  cityCodes: string[];
  company: { id: string; displayName: string; logoUrl: string | null };
};

/** GET /companies: site haritası ve listeler için */
export type PublicCompanyListItem = {
  id: string;
  displayName: string;
  cityName: string | null;
  logoUrl: string | null;
  ratingAverage: string;
  ratingCount: number;
  completedJobs: number;
  updatedAt: string;
  /** Hizmet verdiği iller (merkez il dahil) */
  serviceCityCodes: string[];
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

// ─── Firma paneli ──────────────────────────────────────────────

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type BadgeCode = "DOCUMENTS_VERIFIED" | "FAST_RESPONSE" | "TOP_RATED";

/** GET /company/profile/badges: firma panelinde rozet ilerlemesi */
export type BadgeProgress = {
  documents: { earned: boolean; companyVerified: boolean; missing: string[] };
  fastResponse: {
    earned: boolean;
    quoteCount: number;
    medianMinutes: number | null;
    windowDays: number;
    minQuotes: number;
    maxMedianMinutes: number;
  };
  topRated: { earned: boolean; ratingAverage: number; ratingCount: number; minAverage: number; minCount: number };
};

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
  /** Giriş ve iletişim telefonu: panelde yalnızca gösterilir, firma kendi değiştiremez */
  contactPhone?: string | null;
  /** Yalnızca firmanın kendi profilinde: görünen ad değişikliği onayı ve yıllık hak */
  nameChange?: NameChangeState;
};

/** Onaylı firmanın ad değişikliği yönetim onayına düşer; son 365 günde en fazla `limit` onay */
export type NameChangeState = {
  pending: { newName: string; createdAt: string } | null;
  lastRejected: { newName: string; reviewNote: string | null; reviewedAt: string } | null;
  limit: number;
  used: number;
  remaining: number;
  /** Hak bittiyse bir sonraki değişikliğin yapılabileceği gün */
  nextAvailableAt: string | null;
};

export type NameChange = {
  id: string;
  oldName: string;
  newName: string;
  status: VerificationStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminNameChange = NameChange & {
  company: { id: string; displayName: string; legalName: string; verificationStatus: VerificationStatus };
};

/** Firma panelinde/yönetimde görsel: önizleme imzalı kısa süreli adresten */
export type ShowcaseMedia = {
  id: string;
  kind: "LOGO" | "PHOTO";
  previewUrl: string;
  fullUrl: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
};

/** GET /company/showcase: firmanın tanıtım sayfası */
export type CompanyShowcase = {
  description: string | null;
  services: string[];
  foundedYear: number | null;
  fleetSize: number | null;
  staffSize: number | null;
  logo: ShowcaseMedia | null;
  photos: ShowcaseMedia[];
  indexing: {
    descriptionLength: number;
    minDescription: number;
    visiblePhotos: number;
    minPhotos: number;
    complete: boolean;
    hasReviews: boolean;
  };
  limits: { maxPhotos: number; captionMax: number };
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
  routeKm: number | null;
  routeMinutes: number | null;
  expiresAt: string;
  createdAt: string;
};

export type OwnQuote = Omit<CustomerQuote, "company" | "isExpired"> & {
  createdAt: string;
  /** Teklif verilirken düşülen kredi; iade edildiyse creditRefundedAt dolu */
  creditCost: number;
  creditRefundedAt: string | null;
};

export type CompanyRequest = CompanyRequestView & {
  quoteCount: number;
  /** Müşterinin eklediği fotoğraf ve video sayısı */
  mediaCount: number;
  myQuote: OwnQuote | null;
};

/** Firma talep ayrıntısı: müşterinin eklediği fotoğraf ve videolarla */
export type CompanyRequestDetail = CompanyRequest & { media: RequestMedia[]; credit: RequestCredit };

export type CompanyQuote = OwnQuote & { request: CompanyRequestView };

type BookingPlace = {
  cityName: string | null;
  districtName: string | null;
  address: string;
  floor: number;
  hasElevator: boolean;
  /** Müşterinin haritada işaretlediği nokta */
  location: { lat: number; lng: number } | null;
};

export type CompanyBooking = BookingReviewState & {
  id: string;
  requestId: string;
  status: CustomerBooking["status"];
  scheduledAt: string;
  priceTry: string;
  request: {
    id: string;
    from: BookingPlace;
    to: BookingPlace;
    routeKm: number | null;
    routeMinutes: number | null;
    homeType: string;
    moveDate: string;
    notes: string | null;
  };
  customer: { fullName: string; phone: string };
};

/** GET /company/customers: teklifi kabul edilen müşteriler */
export type CompanyCustomer = {
  fullName: string;
  phone: string;
  bookingCount: number;
  /** Planlanmış (henüz yapılmamış) iş sayısı */
  activeCount: number;
  /** İptal edilmeyen işlerin anlaşma tutarı toplamı */
  totalTry: number;
  lastBooking: {
    id: string;
    status: CustomerBooking["status"];
    scheduledAt: string;
    from: { cityName: string | null; districtName: string | null };
    to: { cityName: string | null; districtName: string | null };
  };
};

/** GET /company/overview: firma panosu */
export type CompanyOverview = {
  requests: { open: number; notQuoted: number };
  quotes: { pending: number; accepted: number; winRate: number | null };
  bookings: { scheduled: number; next7Days: number; completed: number; cancelled: number };
  revenue: { month: string; thisMonthTry: number; lastMonthTry: number };
  rating: { average: number; count: number };
  vehicles: { verified: number; pending: number; rejected: number };
};

/** GET /company/reviews */
export type CompanyReviews = Paginated<
  OwnReview & { customerName: string; bookingId: string; route: string; moveDate: string }
> & {
  summary: {
    ratingAverage: string;
    ratingCount: number;
    distribution: RatingDistribution;
    /** Gizlenenler dahil tüm değerlendirmeler */
    counts: { total: number; unanswered: number; hidden: number };
  };
};

// ─── Mesajlaşma ────────────────────────────────────────────────

export type BookingMessage = {
  id: string;
  /** Hesabı silinen kullanıcının mesajı boş döner */
  body: string;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
};

/** GET /bookings/:id/messages: işin konuşması (eskiden yeniye) */
export type Conversation = {
  bookingId: string;
  requestId: string;
  /** Karşı taraf: müşteriye firma adı, firmaya müşteri adı */
  counterpart: string;
  /** İptal edilen işte, karşı taraf hesabını kapattıysa ya da taraflardan biri engellediyse false */
  canSend: boolean;
  /** byMe: bu kullanıcı karşı tarafı engelledi; byThem: karşı taraf engelledi */
  blocked: { byMe: boolean; byThem: boolean };
  items: BookingMessage[];
};

/** GET /messages/unread */
export type UnreadMessages = { total: number; items: { bookingId: string; requestId: string; count: number }[] };

// ─── Yönetim ───────────────────────────────────────────────────

export type AdminSummary = {
  companies: { pending: number; verified: number; rejected: number };
  requests: { open: number; booked: number; total: number };
  users: { customers: number; companies: number; total: number };
  bookings: { scheduled: number };
  documents: { pending: number };
  vehicles: { pending: number };
  nameChanges: { pending: number };
  transfers: { pending: number };
  reports: { open: number };
  disputes: { open: number };
};

/** GET /admin/bookings/disputes */
export type AdminDispute = Omit<BookingDispute, "completedBy"> & {
  id: string;
  requestId: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  priceTry: string;
  from: string;
  to: string;
  customer: { id: string; fullName: string; phone: string };
  company: { id: string; displayName: string; phone: string };
  messageCount: number;
};

export type ReportTarget = "MESSAGE" | "REVIEW" | "REVIEW_REPLY";
export type ReportReason = "SPAM" | "ABUSE" | "INAPPROPRIATE" | "FRAUD" | "OTHER";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
type ReportPerson = { id: string; name: string; role: UserRole; deleted: boolean };

/** GET /admin/reports: kullanıcıların bildirdiği mesaj, yorum ve firma yanıtları */
export type AdminReport = {
  id: string;
  target: ReportTarget;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  /** Bildirildiği andaki metin */
  content: string;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: ReportPerson | null;
  author: ReportPerson | null;
  requestId: string | null;
};
export type AdminReportList = Paginated<AdminReport> & { counts: { open: number } };

type StatsTotals = {
  requests: number;
  quotes: number;
  bookings: number;
  completed: number;
  customers: number;
  companies: number;
  verifiedCompanies: number;
};

/** GET /admin/stats?days=7|30|90 — oranlar 0-1 arası, payda 0 ise null; tutarlar TL metin */
export type AdminStats = {
  period: { days: 7 | 30 | 90; from: string; to: string; previousFrom: string };
  totals: { current: StatsTotals; previous: StatsTotals };
  funnel: {
    requests: number;
    quoted: number;
    booked: number;
    completed: number;
    quotedRate: number | null;
    bookedRate: number | null;
    completedRate: number | null;
  };
  averages: { quotesPerRequest: number | null; acceptedPriceTry: string | null; acceptedTotalTry: string };
  ratings: { count: number; average: number | null; distribution: { rating: number; count: number }[] };
  cities: { code: string; name: string; requests: number; booked: number }[];
  daily: { day: string; requests: number; quotes: number; bookings: number }[];
};

type CompanyOwner = { fullName: string; phone: string; email: string | null };

export type AdminCompany = CompanyProfile & {
  serviceCities: { code: string; name: string | null }[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: CompanyOwner;
  /** Yalnızca listede: onaylı araç sayısı */
  verifiedVehicles?: number;
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

export type VehicleFileKind = "REGISTRATION" | "FRONT" | "SIDE" | "REAR";

/** Firmanın aracı: ruhsat ve plakası görünen önden, yandan, arkadan fotoğraflar */
export type CompanyVehicle = {
  id: string;
  /** Boşluksuz, büyük harf (34ABC123) */
  plate: string;
  type: VehicleType;
  authorization: "K3" | "L1";
  status: VerificationStatus;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  files: {
    kind: VehicleFileKind;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    /** Kısa süreli imzalı görüntüleme adresi */
    url: string;
  }[];
};

/** GET /company/vehicles: araçlar ve onaylı araç sayısı (firma onayı için en az bir onaylı araç gerekir) */
export type CompanyVehicleSummary = { vehicles: CompanyVehicle[]; verifiedCount: number };

/** GET /admin/vehicles: araç ve ait olduğu firma */
export type AdminVehicle = CompanyVehicle & {
  company: { id: string; displayName: string; legalName: string; verificationStatus: VerificationStatus };
};

export type AdminCompanyDetail = AdminCompany &
  CompanyDocumentSummary &
  CompanyVehicleSummary & {
  owner: CompanyOwner & { id: string; createdAt: string };
  /** Tanıtım sayfası görselleri (gizlenenler dahil) */
  media: ShowcaseMedia[];
  /** Görünen ad değişiklikleri, en yeni önce */
  nameChanges: NameChange[];
  quoteCount: number;
  bookingCount: number;
  history: {
    action: string;
    details: {
      from?: VerificationStatus;
      to?: VerificationStatus;
      note?: string | null;
      type?: CompanyDocument["type"];
      method?: string;
      path?: string;
      /** Araç kararları */
      plate?: string;
      /** Görünen ad değişikliği */
      oldName?: string;
      newName?: string;
      /** Zorunlu belge/araç eksikken yönetici gerekçeyle onayladı; o anki eksikler */
      override?: boolean;
      missing?: string[];
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
  booking: (BookingDispute & {
    id: string;
    status: CustomerBooking["status"];
    scheduledAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
  }) | null;
};

export type AdminReview = OwnReview & {
  hiddenAt: string | null;
  company: { id: string; displayName: string };
  customer: { id: string; fullName: string };
  requestId: string;
  route: string;
  moveDate: string;
};

/** GET /admin/reviews: liste ve süzgeçten bağımsız genel sayaçlar */
export type AdminReviews = Paginated<AdminReview> & {
  stats: { total: number; ratingAverage: number; hidden: number; unanswered: number; lowRating: number; lastWeek: number };
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
  /** Anlık bildirim: publicKey null ise sunucuda kapalı; devices = bildirimi açık cihaz sayısı */
  push?: { publicKey: string | null; devices: number };
  items: {
    type: string;
    label: string;
    description: string;
    channels: Partial<Record<NotificationChannel, boolean>>;
  }[];
};

// ─── Firma takvimi ─────────────────────────────────────────────

/** GET /company/bookings/calendar?from=&to= */
export type CompanyCalendar = {
  from: string;
  to: string;
  items: {
    id: string;
    status: CustomerBooking["status"];
    /** Taşınma günü, "2026-10-04" */
    day: string;
    scheduledAt: string;
    priceTry: string;
    homeType: string;
    from: { cityName: string | null; districtName: string | null };
    to: { cityName: string | null; districtName: string | null };
    customerName: string;
  }[];
};
