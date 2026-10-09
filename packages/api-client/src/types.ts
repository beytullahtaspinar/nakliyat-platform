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
