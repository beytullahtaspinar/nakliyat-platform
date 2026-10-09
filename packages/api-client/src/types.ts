// API yanıt tipleri. Web tarafındaki karşılıkları apps/web/src/lib/api.ts içinde; alan eklerken ikisini birlikte güncelle.

export type UserRole = 'CUSTOMER' | 'COMPANY' | 'ADMIN';

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

export type AuthTokens = { accessToken: string; refreshToken: string };
export type AuthResponse = AuthTokens & { user: AuthUser };

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

export type RequestStatus = 'DRAFT' | 'OPEN' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

/** GET /requests: müşterinin talepleri */
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
  routeKm: number | null;
  routeMinutes: number | null;
  expiresAt: string;
  createdAt: string;
  quoteCount: number;
};

/** GET /company/overview: firma panosu */
export type CompanyOverview = {
  requests: { open: number; notQuoted: number };
  quotes: { pending: number; accepted: number; winRate: number | null };
  bookings: { scheduled: number; next7Days: number; completed: number; cancelled: number };
  revenue: { month: string; thisMonthTry: number; lastMonthTry: number };
  rating: { average: number; count: number };
};

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
export type VehicleType = 'PANELVAN' | 'KAMYONET' | 'KAMYON' | 'TIR';

/** GET /company/profile (mobilde kullanılan alanlar) */
export type CompanyProfile = {
  id: string;
  legalName: string;
  displayName: string;
  cityName: string | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  serviceCityCodes: string[];
};

/** Firmanın gördüğü talep: müşteri kimliği ve açık adres gizli */
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

/** Firmanın kendi teklifi */
export type OwnQuote = {
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
  createdAt: string;
  /** Teklif verilirken düşülen kredi */
  creditCost: number;
  creditRefundedAt: string | null;
};

/** GET /company/requests */
export type CompanyRequest = CompanyRequestView & {
  quoteCount: number;
  mediaCount: number;
  myQuote: OwnQuote | null;
};

export type RequestMedia = {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  /** Kısa süreli imzalı görüntüleme adresi */
  url: string;
};

/** Bu talebe teklifin kredi bedeli ve firmanın bakiyesi */
export type RequestCredit = { enabled: boolean; cost: number; balance: number };

/** GET /company/requests/:id */
export type CompanyRequestDetail = CompanyRequest & { media: RequestMedia[]; credit: RequestCredit };

/** GET /company/quotes */
export type CompanyQuote = OwnQuote & { requestId: string; request: CompanyRequestView };

/** POST /company/requests/:id/quotes, PATCH /company/quotes/:id */
export type QuoteInput = {
  priceTry: number;
  crewSize: number;
  vehicleType: VehicleType;
  includesPacking: boolean;
  includesAssembly: boolean;
  includesInsurance: boolean;
  message?: string;
};

export type BookingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

/** Müşterinin ve firmanın kendi ekranında gördüğü değerlendirme */
export type OwnReview = {
  id: string;
  rating: number;
  comment: string | null;
  companyReply: string | null;
  companyReplyAt: string | null;
  /** Yönetici gizlediyse false */
  isPublished: boolean;
  hiddenReason: string | null;
  createdAt: string;
};

export type BookingPlace = {
  cityName: string | null;
  districtName: string | null;
  address: string;
  floor: number;
  hasElevator: boolean;
  /** Müşterinin haritada işaretlediği nokta */
  location: { lat: number; lng: number } | null;
};

/** GET /company/bookings, /company/bookings/:id: anlaşma sonrası müşteri bilgisi ve açık adres açılır */
export type CompanyBooking = {
  id: string;
  requestId: string;
  status: BookingStatus;
  scheduledAt: string;
  priceTry: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Planlanmış ve taşınma günü gelmiş */
  canComplete: boolean;
  /** Planlanmış ve taşınma günü geçmemiş */
  canCancel: boolean;
  review: OwnReview | null;
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

export type BookingMessage = {
  id: string;
  /** Hesabı silinen kullanıcının mesajı boş döner */
  body: string;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
};

/** GET /bookings/:id/messages (eskiden yeniye) */
export type Conversation = {
  bookingId: string;
  requestId: string;
  /** Firmaya müşteri adı, müşteriye firma adı */
  counterpart: string;
  /** İptal edilen işte ya da karşı taraf hesabını kapattıysa false */
  canSend: boolean;
  items: BookingMessage[];
};

/** GET /messages/unread */
export type UnreadMessages = { total: number; items: { bookingId: string; requestId: string; count: number }[] };

/** GET /company/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD (en fazla 42 gün) */
export type CompanyCalendar = {
  from: string;
  to: string;
  items: {
    id: string;
    status: BookingStatus;
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

// ─── Firma hesabı: belgeler, kredi, değerlendirmeler, müşteriler ──────────

export type DocumentType = 'K3_LICENSE' | 'TAX_CERTIFICATE' | 'TRADE_REGISTRY' | 'INSURANCE' | 'OTHER';

export type CompanyDocument = {
  id: string;
  type: DocumentType;
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
  type: DocumentType;
  state: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED' | 'MISSING';
};

/** GET /company/documents */
export type CompanyDocumentSummary = { documents: CompanyDocument[]; requirements: DocumentRequirement[] };

/** Dosya yükleme adresi: dosya bu adrese PUT ile gönderilir */
export type UploadTicket = { key: string; url: string; method: 'PUT'; headers: Record<string, string> };

/** GET /company/credits (uygulamada yalnızca bakiye ve ücretler kullanılır) */
export type CompanyCreditSummary = {
  enabled: boolean;
  balance: number;
  quoteCostLocal: number;
  quoteCostIntercity: number;
  lowBalanceThreshold: number;
};

export type CreditTransactionType =
  | 'QUOTE'
  | 'QUOTE_REFUND'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'WELCOME'
  | 'TRANSFER_TOPUP'
  | 'CARD_TOPUP';

export type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  request: { id: string; fromCityName: string | null; toCityName: string | null } | null;
};

export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

/** GET /company/reviews */
export type CompanyReviews = Paginated<OwnReview & { customerName: string; bookingId: string; route: string; moveDate: string }> & {
  summary: {
    ratingAverage: string;
    ratingCount: number;
    distribution: RatingDistribution;
    counts: { total: number; unanswered: number; hidden: number };
  };
};

/** GET /company/customers */
export type CompanyCustomer = {
  fullName: string;
  phone: string;
  bookingCount: number;
  activeCount: number;
  totalTry: number;
  lastBooking: {
    id: string;
    status: BookingStatus;
    scheduledAt: string;
    from: { cityName: string | null; districtName: string | null };
    to: { cityName: string | null; districtName: string | null };
  };
};

// ─── Müşteri ──────────────────────────────────────────────

/** GET /locations/cities */
export type City = { code: string; name: string; slug: string };
/** GET /locations/cities/:code/districts */
export type District = { name: string; slug: string };

/** GET /auth/verification */
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
  phoneChannel: 'sms' | 'whatsapp' | null;
  phoneCodeSent: boolean;
  phoneResendAt: string | null;
  complete: boolean;
};

/** GET /requests/:id: müşterinin kendi talebi, açık adresler ve medya dahil */
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

/** POST /requests gövdesi */
export type CreateRequestInput = {
  fromCityCode: string;
  fromDistrict: string;
  fromAddress: string;
  fromFloor: number;
  fromHasElevator: boolean;
  toCityCode: string;
  toDistrict: string;
  toAddress: string;
  toFloor: number;
  toHasElevator: boolean;
  homeType: string;
  /** YYYY-AA-GG */
  moveDate: string;
  isDateFlexible: boolean;
  needsPacking: boolean;
  needsAssembly: boolean;
  needsStorage: boolean;
  specialItems?: string[];
  notes?: string;
};

export type BadgeCode = 'DOCUMENTS_VERIFIED' | 'FAST_RESPONSE' | 'TOP_RATED';

export type PublicCompany = {
  id: string;
  displayName: string;
  logoUrl: string | null;
  cityName: string | null;
  verified: boolean;
  ratingAverage: string;
  ratingCount: number;
  completedJobs: number;
  badges?: BadgeCode[];
};

/** GET /requests/:id/quotes: fiyata göre sıralı */
export type CustomerQuote = {
  id: string;
  status: QuoteStatus;
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

/** GET /bookings: teklif kabulünden sonra firma iletişim bilgisi açılır */
export type CustomerBooking = {
  id: string;
  requestId: string;
  quoteId: string;
  status: BookingStatus;
  scheduledAt: string;
  priceTry: string;
  completedAt: string | null;
  /** Planlanmış ve taşınma günü gelmiş: tamamlandı olarak işaretlenebilir */
  canComplete: boolean;
  /** Planlanmış ve taşınma günü geçmemiş: gerekçeyle iptal edilebilir */
  canCancel: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  review: OwnReview | null;
  company: PublicCompany & { contactName: string; contactPhone: string };
};
