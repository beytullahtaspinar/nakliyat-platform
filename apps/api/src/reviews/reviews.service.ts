import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { CompaniesService, PUBLIC_COMPANY, toPublicCompany } from '../companies/companies.service.js';
import { servicesOf } from '../companies/showcase-rules.js';
import { publicMediaPath } from '../media/media-rules.js';
import { CompanyBadgesService } from '../companies/company-badges.service.js';
import { cityName } from '../common/utils/locations.js';
import { DomainEvents } from '../events/domain-events.js';
import { Prisma, type Review } from '../generated/prisma/client.js';
import { BookingActor, BookingStatus, CompanyMediaKind, RequestStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminListReviewsDto,
  CreateReviewDto,
  LatestReviewsDto,
  ListReviewsDto,
  PublicCompaniesDto,
  ReviewSort,
} from './dto/review.dto.js';
import { moveDayPassed, moveDayReached, replyOutdated } from './review-rules.js';
import { AUTHOR_AND_ROUTE, routeOf, toPublicReview } from './review-snippets.js';

const DISPUTE_OPEN = 'Bu iş için itiraz var; yönetim inceleyip karar verecek';

/** Arama motoruna açık firma sayfası: yorumu var ya da tanıtım yazısı ve fotoğrafları yeterli */
const INDEXABLE_COMPANY = { OR: [{ ratingCount: { gt: 0 } }, { showcaseComplete: true }] } satisfies Prisma.CompanyWhereInput;

const SORT_ORDER: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  lowest: [{ rating: 'asc' }, { createdAt: 'desc' }],
  highest: [{ rating: 'desc' }, { createdAt: 'desc' }],
};

/** Ortak süzgeç: yayında/gizli, puan, yanıt durumu */
const filterWhere = ({ status, rating, reply }: Pick<ListReviewsDto, 'status' | 'rating' | 'reply'>): Prisma.ReviewWhereInput => ({
  ...(status && { isPublished: status === 'visible' }),
  ...(rating && { rating }),
  ...(reply && { companyReply: reply === 'answered' ? { not: null } : null }),
});

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
    editedAt: review.editedAt,
    createdAt: review.createdAt,
    /** Müşteri yorumu firmanın yanıtından sonra düzenledi; firma yanıtını güncelleyebilir */
    replyOutdated: replyOutdated(review),
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
    const { booking, by } = await this.bookingForParty(user, bookingId);
    if (booking.status === BookingStatus.COMPLETED) throw new ConflictException('Bu iş zaten tamamlandı olarak işaretlenmiş');
    if (booking.status === BookingStatus.CANCELLED) throw new ConflictException('İptal edilen iş tamamlanamaz');
    if (booking.disputedAt) throw new ConflictException(DISPUTE_OPEN);
    if (!moveDayReached(booking.scheduledAt)) {
      throw new ConflictException('İş, taşınma günü geldiğinde tamamlandı olarak işaretlenebilir');
    }
    const completedAt = await this.finishBooking(booking, by);
    if (!completedAt) throw new ConflictException('Bu iş zaten tamamlandı olarak işaretlenmiş');
    return { id: booking.id, status: BookingStatus.COMPLETED, completedAt, completedBy: by };
  }

  /**
   * İşi tamamlar: talep tamamlanır, firmanın tamamlanan iş sayısı artar, olay yayınlanır. İş bu arada
   * başka bir yoldan kapandıysa (ya da sistem tamamlarken itiraz geldiyse) hiçbir şey yapmaz ve null döner.
   */
  async finishBooking(
    booking: { id: string; requestId: string; companyId: string },
    by: BookingActor,
    extra?: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<Date | null> {
    const completedAt = new Date();
    const done = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.SCHEDULED,
          // Yönetici itirazlı işi karara bağlar; diğer yollar itirazlı işi tamamlayamaz
          disputedAt: by === BookingActor.ADMIN ? { not: null } : null,
        },
        data: { status: BookingStatus.COMPLETED, completedAt, completedBy: by },
      });
      if (updated.count !== 1) return false;
      await tx.movingRequest.update({ where: { id: booking.requestId }, data: { status: RequestStatus.COMPLETED } });
      await tx.company.update({ where: { id: booking.companyId }, data: { completedJobs: { increment: 1 } } });
      await extra?.(tx);
      return true;
    });
    if (!done) return null;
    this.events.emit('booking.completed', { bookingId: booking.id, completedBy: by });
    return completedAt;
  }

  /**
   * Taraflardan biri "taşınma yapılmadı" der. Taşınma günü geldikten sonra, iş tamamlanmadan yapılabilir.
   * İş kendiliğinden tamamlanmaz; taraflar da tamamlayamaz ya da iptal edemez, yönetici karar verir.
   */
  async disputeBooking(user: AuthUser, bookingId: string, reason: string) {
    const { booking, by } = await this.bookingForParty(user, bookingId);
    if (booking.status === BookingStatus.COMPLETED) {
      throw new ConflictException('Tamamlanan iş için itiraz edilemez; sorun varsa destek@evdenevenakliyat.app adresine yaz');
    }
    if (booking.status === BookingStatus.CANCELLED) throw new ConflictException('İptal edilen iş için itiraz edilemez');
    if (booking.disputedAt) throw new ConflictException(DISPUTE_OPEN);
    if (!moveDayReached(booking.scheduledAt)) {
      throw new ConflictException('Taşınma günü gelmeden itiraz edilemez; vazgeçtiysen işi iptal edebilirsin');
    }
    const disputedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.SCHEDULED, disputedAt: null },
        data: { disputedAt, disputedBy: by, disputeReason: reason },
      });
      if (done.count !== 1) throw new ConflictException('Bu işin durumu değişti, sayfayı yenile');
      await tx.auditLog.create({
        data: {
          actorId: user.impersonatorId ?? user.id,
          action: 'booking.dispute',
          entityType: 'Booking',
          entityId: booking.id,
          details: { disputedBy: by, reason, ...(user.impersonatorId && { onBehalfOf: user.id }) },
        },
      });
    });
    this.events.emit('booking.disputed', { bookingId: booking.id });
    return { id: booking.id, status: BookingStatus.SCHEDULED, disputedAt, disputedBy: by, disputeReason: reason };
  }

  /**
   * Yönetici itirazı karara bağlar: taşınma yapıldıysa iş tamamlanır (müşteri değerlendirebilir),
   * yapılmadıysa iptal edilir. Kredi kendiliğinden iade edilmez; gerekirse yönetici kredi düzeltmesi yapar.
   */
  async resolveDispute(adminId: string, bookingId: string, decision: 'complete' | 'cancel', note: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, requestId: true, companyId: true, disputedAt: true },
    });
    if (!booking) throw new NotFoundException('İş bulunamadı');
    if (!booking.disputedAt || booking.status !== BookingStatus.SCHEDULED) {
      throw new ConflictException('Bu iş için bekleyen bir itiraz yok');
    }
    const resolvedAt = new Date();
    const audit = async (tx: Prisma.TransactionClient) => {
      await tx.booking.update({ where: { id: booking.id }, data: { disputeResolvedAt: resolvedAt, disputeResolution: note } });
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'booking.dispute_resolve', entityType: 'Booking', entityId: booking.id, details: { decision, note } },
      });
    };

    if (decision === 'complete') {
      const completedAt = await this.finishBooking(booking, BookingActor.ADMIN, audit);
      if (!completedAt) throw new ConflictException('Bu işin durumu değişti, sayfayı yenile');
      this.events.emit('booking.dispute_resolved', { bookingId: booking.id, decision, note });
      return { id: booking.id, status: BookingStatus.COMPLETED, completedAt, completedBy: BookingActor.ADMIN, disputeResolution: note };
    }

    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.SCHEDULED },
        data: { status: BookingStatus.CANCELLED, cancelledAt, cancelReason: 'Taşınma yapılmadı (itiraz yönetimce kabul edildi)' },
      });
      if (done.count !== 1) throw new ConflictException('Bu işin durumu değişti, sayfayı yenile');
      await tx.movingRequest.update({ where: { id: booking.requestId }, data: { status: RequestStatus.CANCELLED } });
      await audit(tx);
    });
    this.events.emit('booking.dispute_resolved', { bookingId: booking.id, decision, note });
    return { id: booking.id, status: BookingStatus.CANCELLED, cancelledAt, disputeResolution: note };
  }

  /** İşi, onu görebilen tarafın (müşteri ya da firma) adına okur */
  private async bookingForParty(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        requestId: true,
        companyId: true,
        disputedAt: true,
        request: { select: { customerId: true } },
        company: { select: { ownerId: true } },
      },
    });
    const isCustomer = user.role === UserRole.CUSTOMER && booking?.request.customerId === user.id;
    const isCompany = user.role === UserRole.COMPANY && booking?.company.ownerId === user.id;
    if (!booking || (!isCustomer && !isCompany)) throw new NotFoundException('İş bulunamadı');
    return { booking, by: isCustomer ? BookingActor.CUSTOMER : BookingActor.COMPANY };
  }

  /**
   * Müşteri ya da firma anlaşılan işi gerekçeyle iptal eder (taşınma gününün sonuna kadar).
   * Talep de iptal olur; müşteri yeniden teklif almak için yeni talep açar. Karşı tarafa bildirim gider,
   * konuşma salt okunur kalır. Kimin iptal ettiği denetim kaydında tutulur.
   */
  async cancelBooking(user: AuthUser, bookingId: string, reason: string) {
    const { booking, by: cancelledBy } = await this.bookingForParty(user, bookingId);
    if (booking.status === BookingStatus.CANCELLED) throw new ConflictException('Bu iş zaten iptal edilmiş');
    if (booking.status === BookingStatus.COMPLETED) throw new ConflictException('Tamamlanan iş iptal edilemez');
    if (booking.disputedAt) throw new ConflictException(DISPUTE_OPEN);
    if (moveDayPassed(booking.scheduledAt)) {
      throw new ConflictException('Taşınma günü geçen iş iptal edilemez; taşınma yapılmadıysa itiraz edebilirsin');
    }

    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.SCHEDULED, disputedAt: null },
        data: { status: BookingStatus.CANCELLED, cancelledAt, cancelReason: reason },
      });
      if (done.count !== 1) throw new ConflictException('Bu işin durumu değişti, sayfayı yenile');
      await tx.movingRequest.update({ where: { id: booking.requestId }, data: { status: RequestStatus.CANCELLED } });
      await tx.auditLog.create({
        data: {
          actorId: user.impersonatorId ?? user.id,
          action: 'booking.cancel',
          entityType: 'Booking',
          entityId: booking.id,
          details: { cancelledBy, reason, ...(user.impersonatorId && { onBehalfOf: user.id }) },
        },
      });
    });
    this.events.emit('booking.cancelled', { bookingId: booking.id, cancelledBy });
    return { id: booking.id, status: BookingStatus.CANCELLED, cancelledAt, cancelReason: reason, cancelledBy };
  }

  /** Müşteri tamamlanan işin firmasını puanlar; iş başına bir değerlendirme (sonradan düzenlenebilir). */
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

  /**
   * Müşteri puanını ve yorumunu sonradan düzenler. Firmanın yanıtı korunur; yorumda "düzenlendi" görünür,
   * firmaya haber verilir ve firma yanıtını güncelleyebilir. Yönetimce gizlenen yorum düzenlenemez
   * (gizleme gerekçesi o metne ait). Önceki puan ve metin denetim kaydında kalır.
   */
  async update(customerId: string, bookingId: string, dto: CreateReviewDto) {
    const review = await this.prisma.review.findFirst({ where: { bookingId, customerId } });
    if (!review) throw new NotFoundException('Değerlendirme bulunamadı');
    if (!review.isPublished) {
      throw new ConflictException('Yayından kaldırılan değerlendirme düzenlenemez; itirazın varsa destek@evdenevenakliyat.app adresine yaz');
    }
    const comment = dto.comment ?? null;
    if (review.rating === dto.rating && review.comment === comment) return toReviewView(review);

    await this.prisma.$transaction(async (tx) => {
      // Yönetici aynı anda gizlediyse düzenleme yapılmaz
      const done = await tx.review.updateMany({
        where: { id: review.id, isPublished: true },
        data: { rating: dto.rating, comment, editedAt: new Date() },
      });
      if (done.count !== 1) throw new ConflictException('Bu değerlendirmenin durumu değişti, sayfayı yenile');
      await tx.auditLog.create({
        data: {
          actorId: customerId,
          action: 'review.edit',
          entityType: 'Review',
          entityId: review.id,
          details: {
            companyId: review.companyId,
            before: { rating: review.rating, comment: review.comment },
            after: { rating: dto.rating, comment },
          },
        },
      });
    });
    if (review.rating !== dto.rating) await this.refreshRating(review.companyId);
    this.events.emit('review.updated', { reviewId: review.id, previousRating: review.rating });
    return toReviewView(await this.prisma.review.findUniqueOrThrow({ where: { id: review.id } }));
  }

  /** Firmanın kendi değerlendirmeleri (gizlenenler dahil), en yeni önce, puan dağılımıyla */
  async listForCompany(ownerId: string, { page, limit, sort, q, ...filters }: ListReviewsDto) {
    const company = await this.companies.requireCompany(ownerId);
    const own = { companyId: company.id };
    const where: Prisma.ReviewWhereInput = {
      ...own,
      ...filterWhere(filters),
      ...(q && { OR: [{ comment: { contains: q } }, { customer: { fullName: { contains: q } } }] }),
    };
    const [items, total, distribution, all, unanswered, hidden] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: SORT_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        include: AUTHOR_AND_ROUTE,
      }),
      this.prisma.review.count({ where }),
      this.distribution(company.id),
      this.prisma.review.count({ where: own }),
      this.prisma.review.count({ where: { ...own, companyReply: null } }),
      this.prisma.review.count({ where: { ...own, isPublished: false } }),
    ]);
    return {
      summary: {
        ratingAverage: company.ratingAverage,
        ratingCount: company.ratingCount,
        distribution,
        // Gizlenenler dahil tüm değerlendirmeler
        counts: { total: all, unanswered, hidden },
      },
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

  /**
   * Firma yoruma bir kez yanıt verir; yanıt herkese açık sayfada yorumun altında görünür.
   * Müşteri yorumunu yanıttan sonra düzenlediyse firma yanıtını bir kez daha güncelleyebilir.
   */
  async reply(ownerId: string, reviewId: string, body: string) {
    const company = await this.companies.requireCompany(ownerId);
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, companyId: company.id } });
    if (!review) throw new NotFoundException('Değerlendirme bulunamadı');
    if (review.companyReply !== null && !replyOutdated(review)) throw new ConflictException('Bu yoruma zaten yanıt verdin');
    // Okunan yanıt zamanı değişmediyse yazılır: aynı anda iki gönderimden yalnızca biri geçer
    const updated = await this.prisma.review.updateMany({
      where: { id: review.id, companyReplyAt: review.companyReplyAt },
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
        media: { where: { hiddenAt: null, kind: CompanyMediaKind.PHOTO }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const serviceCodes = [...new Set([company.cityCode, ...company.serviceCities.map((c) => c.cityCode)])].sort();
    const badges = await this.badges.forCompanies([company]);
    return {
      ...toPublicCompany(company),
      // Vergi levhasındaki resmi unvan: görünen ad ne olursa olsun müşteri kiminle çalıştığını bilsin
      legalName: company.legalName,
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

  /**
   * Sitedeki en yeni yorumlar (ana sayfa ve il sayfaları): yalnızca yazılı, yayındaki yorumlar ve
   * herkese açık firmalar. city verilirse çıkışı ya da varışı o il olan taşımalar. Puana göre süzülmez.
   */
  async latestPublic({ limit, city }: LatestReviewsDto) {
    const items = await this.prisma.review.findMany({
      where: {
        isPublished: true,
        comment: { not: null },
        company: PUBLIC_COMPANY,
        ...(city && { booking: { request: { OR: [{ fromCityCode: city }, { toCityCode: city }] } } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { ...AUTHOR_AND_ROUTE, company: { select: { id: true, displayName: true, logoUrl: true } } },
    });
    return {
      items: items.map((r) => ({
        ...toPublicReview(r),
        // İl sayfaları kendi bölgesinin yorumlarını süzer
        cityCodes: [...new Set([r.booking.request.fromCityCode, r.booking.request.toCityCode])],
        company: { id: r.company.id, displayName: r.company.displayName, logoUrl: r.company.logoUrl },
      })),
    };
  }

  /**
   * İl bazında yayındaki puanların ortalaması (il sayfaları). Bir taşıma hem çıkış hem varış ilinde sayılır,
   * aynı il içindeyse bir kez. Yazısız puanlar da sayılır; yalnızca herkese açık firmalar.
   */
  async cityRatings() {
    const rows = await this.prisma.review.findMany({
      where: { isPublished: true, company: PUBLIC_COMPANY },
      select: { rating: true, booking: { select: { request: { select: { fromCityCode: true, toCityCode: true } } } } },
    });
    const totals = new Map<string, { sum: number; count: number }>();
    for (const { rating, booking } of rows) {
      for (const code of new Set([booking.request.fromCityCode, booking.request.toCityCode])) {
        const t = totals.get(code) ?? { sum: 0, count: 0 };
        t.sum += rating;
        t.count += 1;
        totals.set(code, t);
      }
    }
    return {
      items: [...totals]
        .map(([cityCode, t]) => ({ cityCode, count: t.count, average: Math.round((t.sum / t.count) * 100) / 100 }))
        .sort((a, b) => a.cityCode.localeCompare(b.cityCode)),
    };
  }

  // ─── Yönetim ─────────────────────────────────────────────────

  async adminList({ page, limit, sort, q, ...filters }: AdminListReviewsDto) {
    const where: Prisma.ReviewWhereInput = {
      ...filterWhere(filters),
      ...(q && {
        OR: [
          { company: { displayName: { contains: q } } },
          { comment: { contains: q } },
          { customer: { fullName: { contains: q } } },
        ],
      }),
    };
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [items, total, all, published, hidden, unanswered, low, recent] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: SORT_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...AUTHOR_AND_ROUTE,
          customer: { select: { id: true, fullName: true, deletedAt: true } },
          company: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.count(),
      this.prisma.review.aggregate({ where: { isPublished: true }, _avg: { rating: true } }),
      this.prisma.review.count({ where: { isPublished: false } }),
      this.prisma.review.count({ where: { companyReply: null } }),
      this.prisma.review.count({ where: { isPublished: true, rating: { lte: 2 } } }),
      this.prisma.review.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);
    return {
      items: items.map((r) => ({
        ...toReviewView(r),
        hiddenAt: r.hiddenAt,
        company: r.company,
        customer: { id: r.customer.id, fullName: r.customer.fullName },
        requestId: r.booking.requestId,
        route: routeOf(r.booking.request),
        moveDate: r.booking.scheduledAt,
      })),
      total,
      page,
      limit,
      /** Süzgeçten bağımsız genel durum (pano kutuları) */
      stats: {
        total: all,
        ratingAverage: Math.round((published._avg.rating ?? 0) * 100) / 100,
        hidden,
        unanswered,
        lowRating: low,
        lastWeek: recent,
      },
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
