import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getCityByCode } from '@nakliyat/locations';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { CompaniesService, PUBLIC_COMPANY, toPublicCompany } from '../companies/companies.service.js';
import { servicesOf } from '../companies/showcase-rules.js';
import { publicMediaPath } from '../media/media-rules.js';
import { CompanyBadgesService } from '../companies/company-badges.service.js';
import { cityName } from '../common/utils/locations.js';
import { DomainEvents } from '../events/domain-events.js';
import { Prisma, type Review } from '../generated/prisma/client.js';
import { BookingStatus, CompanyMediaKind, RequestStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminListReviewsDto, CreateReviewDto, PublicCompaniesDto } from './dto/review.dto.js';
import { maskName, moveDayReached } from './review-rules.js';

/** Arama motoruna açık firma sayfası: yorumu var ya da tanıtım yazısı ve fotoğrafları yeterli */
const INDEXABLE_COMPANY = { OR: [{ ratingCount: { gt: 0 } }, { showcaseComplete: true }] } satisfies Prisma.CompanyWhereInput;

const AUTHOR_AND_ROUTE = {
  customer: { select: { fullName: true, deletedAt: true } },
  booking: { select: { requestId: true, scheduledAt: true, request: { select: { fromCityCode: true, toCityCode: true } } } },
} satisfies Prisma.ReviewInclude;
type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: typeof AUTHOR_AND_ROUTE }>;

/** Müşterinin ve firmanın kendi ekranında gördüğü değerlendirme (gizlenme durumu dahil) */
export function toReviewView(review: Review) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    companyReply: review.companyReply,
    companyReplyAt: review.companyReplyAt,
    isPublished: review.isPublished,
    hiddenReason: review.hiddenReason,
    createdAt: review.createdAt,
  };
}

/** "İzmir → Ankara": yalnızca il adları, ilçe ve adres yok */
const routeOf = (r: { fromCityCode: string; toCityCode: string }) => {
  const from = getCityByCode(r.fromCityCode)?.name ?? r.fromCityCode;
  const to = getCityByCode(r.toCityCode)?.name ?? r.toCityCode;
  return from === to ? `${from} içi` : `${from} → ${to}`;
};

/** Herkese açık firma sayfasındaki yorum: müşterinin adı kısaltılır, gizlenme bilgisi yok */
function toPublicReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    authorName: maskName(review.customer.fullName, !!review.customer.deletedAt),
    route: routeOf(review.booking.request),
    createdAt: review.createdAt,
    companyReply: review.companyReply,
    companyReplyAt: review.companyReplyAt,
  };
}

/**
 * İşin tamamlanması, müşterinin puan/yorumu, firmanın yanıtı ve yöneticinin gizlemesi.
 * Firmanın ortalama puanı ve yorum sayısı (Company.ratingAverage/ratingCount) her değişiklikte
 * yalnızca yayındaki yorumlardan yeniden hesaplanır.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly companies: CompaniesService,
    private readonly badges: CompanyBadgesService,
  ) {}

  /**
   * Müşteri ya da firma işi tamamlandı olarak işaretler. Taşınma günü gelmeden yapılamaz.
   * Tamamlanınca talep de tamamlanır, firmanın tamamlanan iş sayısı artar ve müşteri değerlendirme yapabilir.
   */
  async completeBooking(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        requestId: true,
        companyId: true,
        request: { select: { customerId: true } },
        company: { select: { ownerId: true } },
      },
    });
    const isCustomer = user.role === UserRole.CUSTOMER && booking?.request.customerId === user.id;
    const isCompany = user.role === UserRole.COMPANY && booking?.company.ownerId === user.id;
    if (!booking || (!isCustomer && !isCompany)) throw new NotFoundException('İş bulunamadı');
    if (booking.status === BookingStatus.COMPLETED) throw new ConflictException('Bu iş zaten tamamlandı olarak işaretlenmiş');
    if (booking.status === BookingStatus.CANCELLED) throw new ConflictException('İptal edilen iş tamamlanamaz');
    if (!moveDayReached(booking.scheduledAt)) {
      throw new ConflictException('İş, taşınma günü geldiğinde tamamlandı olarak işaretlenebilir');
    }

    const completedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.SCHEDULED },
        data: { status: BookingStatus.COMPLETED, completedAt },
      });
      if (done.count !== 1) throw new ConflictException('Bu iş zaten tamamlandı olarak işaretlenmiş');
      await tx.movingRequest.update({ where: { id: booking.requestId }, data: { status: RequestStatus.COMPLETED } });
      await tx.company.update({ where: { id: booking.companyId }, data: { completedJobs: { increment: 1 } } });
    });
    this.events.emit('booking.completed', { bookingId: booking.id, completedBy: isCustomer ? 'CUSTOMER' : 'COMPANY' });
    return { id: booking.id, status: BookingStatus.COMPLETED, completedAt };
  }

  /** Müşteri tamamlanan işin firmasını puanlar; iş başına bir değerlendirme, sonradan değiştirilemez. */
  async create(customerId: string, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, request: { customerId } },
      select: { id: true, status: true, companyId: true, review: { select: { id: true } } },
    });
    if (!booking) throw new NotFoundException('İş bulunamadı');
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException('Firmayı taşınman tamamlandıktan sonra değerlendirebilirsin');
    }
    if (booking.review) throw new ConflictException('Bu taşıma için zaten değerlendirme yaptın');

    let review: Review;
    try {
      review = await this.prisma.review.create({
        data: { bookingId, companyId: booking.companyId, customerId, rating: dto.rating, comment: dto.comment ?? null },
      });
    } catch (err) {
      // Aynı anda iki gönderim: ikincisi benzersizlik kuralına takılır
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu taşıma için zaten değerlendirme yaptın');
      }
      throw err;
    }
    await this.refreshRating(booking.companyId);
    this.events.emit('review.created', { reviewId: review.id });
    return toReviewView(review);
  }

  /** Firmanın kendi değerlendirmeleri (gizlenenler dahil), en yeni önce, puan dağılımıyla */
  async listForCompany(ownerId: string, page: number, limit: number) {
    const company = await this.companies.requireCompany(ownerId);
    const where = { companyId: company.id };
    const [items, total, distribution] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: AUTHOR_AND_ROUTE,
      }),
      this.prisma.review.count({ where }),
      this.distribution(company.id),
    ]);
    return {
      summary: { ratingAverage: company.ratingAverage, ratingCount: company.ratingCount, distribution },
      items: items.map((r) => ({
        ...toReviewView(r),
        // Firma müşteriyi iş kaydından zaten tanıyor
        customerName: r.customer.deletedAt ? 'Silinmiş kullanıcı' : r.customer.fullName,
        bookingId: r.bookingId,
        route: routeOf(r.booking.request),
        moveDate: r.booking.scheduledAt,
      })),
      total,
      page,
      limit,
    };
  }

  /** Firma yoruma bir kez yanıt verir; yanıt herkese açık sayfada yorumun altında görünür. */
  async reply(ownerId: string, reviewId: string, body: string) {
    const company = await this.companies.requireCompany(ownerId);
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, companyId: company.id } });
    if (!review) throw new NotFoundException('Değerlendirme bulunamadı');
    const updated = await this.prisma.review.updateMany({
      where: { id: review.id, companyReply: null },
      data: { companyReply: body, companyReplyAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException('Bu yoruma zaten yanıt verdin');
    return toReviewView(await this.prisma.review.findUniqueOrThrow({ where: { id: review.id } }));
  }

  // ─── Herkese açık ────────────────────────────────────────────

  async listPublicCompanies({ page, limit, reviewed, indexable, city, toCity }: PublicCompaniesDto) {
    const serves = (code: string): Prisma.CompanyWhereInput => ({
      OR: [{ cityCode: code }, { serviceCities: { some: { cityCode: code } } }],
    });
    const where: Prisma.CompanyWhereInput = {
      ...PUBLIC_COMPANY,
      AND: [
        ...(reviewed === 'true' ? [{ ratingCount: { gt: 0 } }] : []),
        ...(indexable === 'true' ? [INDEXABLE_COMPANY] : []),
        ...(city ? [serves(city)] : []),
        ...(city && toCity ? [serves(toCity)] : []),
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        // İl sayfalarında da bu sıra: önce çok yorum alan, sonra yüksek puanlı, sonra tanıtımı dolu
        orderBy: [{ ratingCount: 'desc' }, { ratingAverage: 'desc' }, { showcaseComplete: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          displayName: true,
          cityCode: true,
          logoUrl: true,
          ratingAverage: true,
          ratingCount: true,
          completedJobs: true,
          updatedAt: true,
          serviceCities: { select: { cityCode: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);
    return {
      // serviceCityCodes: merkez il dahil; il sayfaları tek istekle tüm firmaları alıp kendi içinde süzer
      items: items.map(({ cityCode, serviceCities, ...c }) => ({
        ...c,
        cityName: cityName(cityCode),
        serviceCityCodes: [...new Set([cityCode, ...serviceCities.map((s) => s.cityCode)])].sort(),
      })),
      total,
      page,
      limit,
    };
  }

  /** Firma profili: vergi no, belge, sahip bilgisi yok. Görseller yalnızca gizlenmemişler. */
  async publicProfile(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ...PUBLIC_COMPANY },
      include: {
        serviceCities: { select: { cityCode: true } },
        media: { where: { hiddenAt: null, kind: CompanyMediaKind.PHOTO }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const serviceCodes = [...new Set([company.cityCode, ...company.serviceCities.map((c) => c.cityCode)])].sort();
    const badges = await this.badges.forCompanies([company]);
    return {
      ...toPublicCompany(company),
      badges: badges.get(company.id) ?? [],
      cityCode: company.cityCode,
      description: company.description,
      services: servicesOf(company.services),
      foundedYear: company.foundedYear,
      fleetSize: company.fleetSize,
      staffSize: company.staffSize,
      photos: company.media.map((m) => ({
        id: m.id,
        url: publicMediaPath(m.storageKey),
        thumbUrl: m.thumbKey ? publicMediaPath(m.thumbKey) : publicMediaPath(m.storageKey),
        width: m.width,
        height: m.height,
        caption: m.caption,
      })),
      // Yorumu olan ya da tanıtımı yeterince dolu (showcase-rules.ts INDEX_RULES) sayfa arama motoruna açık
      indexable: company.ratingCount > 0 || company.showcaseComplete,
      serviceCities: serviceCodes.map((code) => ({ code, name: cityName(code) })),
      verifiedAt: company.verifiedAt,
      memberSince: company.createdAt,
      updatedAt: company.updatedAt,
      ratingDistribution: await this.distribution(company.id),
    };
  }

  async publicReviews(companyId: string, page: number, limit: number) {
    const exists = await this.prisma.company.count({ where: { id: companyId, ...PUBLIC_COMPANY } });
    if (!exists) throw new NotFoundException('Firma bulunamadı');
    const where = { companyId, isPublished: true };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: AUTHOR_AND_ROUTE,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: items.map(toPublicReview), total, page, limit };
  }

  // ─── Yönetim ─────────────────────────────────────────────────

  async adminList({ status, rating, q, page, limit }: AdminListReviewsDto) {
    const where: Prisma.ReviewWhereInput = {
      ...(status && { isPublished: status === 'visible' }),
      ...(rating && { rating }),
      ...(q && { OR: [{ company: { displayName: { contains: q } } }, { comment: { contains: q } }] }),
    };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...AUTHOR_AND_ROUTE,
          customer: { select: { id: true, fullName: true, deletedAt: true } },
          company: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items: items.map((r) => ({
        ...toReviewView(r),
        hiddenAt: r.hiddenAt,
        company: r.company,
        customer: { id: r.customer.id, fullName: r.customer.fullName },
        requestId: r.booking.requestId,
        route: routeOf(r.booking.request),
      })),
      total,
      page,
      limit,
    };
  }

  /** Yönetici yorumu gizler (ör. hakaret, kişisel veri, reklam). Gizli yorum puana girmez, firma gerekçeyi görür. */
  async hide(adminId: string, reviewId: string, reason: string) {
    const review = await this.requireReview(reviewId);
    const [updated] = await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id: review.id },
        data: { isPublished: false, hiddenReason: reason, hiddenAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'review.hide', entityType: 'Review', entityId: review.id, details: { reason, companyId: review.companyId } },
      }),
    ]);
    await this.refreshRating(review.companyId);
    return toReviewView(updated);
  }

  async show(adminId: string, reviewId: string) {
    const review = await this.requireReview(reviewId);
    const [updated] = await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id: review.id },
        data: { isPublished: true, hiddenReason: null, hiddenAt: null },
      }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'review.show', entityType: 'Review', entityId: review.id, details: { companyId: review.companyId } },
      }),
    ]);
    await this.refreshRating(review.companyId);
    return toReviewView(updated);
  }

  private async requireReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Değerlendirme bulunamadı');
    return review;
  }

  /** Yayındaki yorumların puan dağılımı: { "5": 12, "4": 3, ... } (her puan için, sıfırlar dahil) */
  private async distribution(companyId: string) {
    const rows = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { companyId, isPublished: true },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(rows.map((r) => [r.rating, r._count._all]));
    return Object.fromEntries([5, 4, 3, 2, 1].map((n) => [String(n), counts[n] ?? 0])) as Record<'1' | '2' | '3' | '4' | '5', number>;
  }

  /** Ortalama ve yorum sayısını yayındaki yorumlardan yeniden hesaplar */
  async refreshRating(companyId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { companyId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ratingAverage: Math.round((agg._avg.rating ?? 0) * 100) / 100,
        ratingCount: agg._count._all,
      },
    });
  }
}
