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
