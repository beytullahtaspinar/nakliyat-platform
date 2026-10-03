import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { getCityByCode } from '@nakliyat/locations';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BookingStatus, RequestStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fillDays, ratio, statsRange } from './admin-stats.js';
import { AdminStatsDto } from './dto/admin-stats.dto.js';

/** İl tablosunda gösterilen en çok talep gelen il sayısı */
const TOP_CITIES = 10;

/**
 * Yönetim istatistikleri: seçilen dönemde (son 7/30/90 gün, Türkiye saatiyle) talep → teklif → iş → tamamlanan
 * hunisi, önceki eşit dönemle karşılaştırma, günlük seri, il kırılımı ve puanlar.
 * Taslak talepler (doğrulanmamış hesap) sayılmaz; sonradan silinen hesapların talepleri geçmişte kaldığı için sayılır.
 */
@ApiTags('Admin: istatistikler')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats(@Query() { days }: AdminStatsDto) {
    const { from, to, previousFrom } = statsRange(days);
    const [current, previous] = await Promise.all([this.totals(from, to), this.totals(previousFrom, from)]);
    const [funnel, quotesForCohort, accepted, ratings, ratingRows, cities, citiesBooked, daily] = await Promise.all([
      this.funnel(from, to),
      this.prisma.quote.count({ where: { request: requestsIn(from, to) } }),
      this.prisma.quote.aggregate({
        where: { booking: { createdAt: { gte: from, lt: to } } },
        _sum: { priceTry: true },
        _avg: { priceTry: true },
      }),
      this.prisma.review.aggregate({
        where: { isPublished: true, createdAt: { gte: from, lt: to } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { isPublished: true, createdAt: { gte: from, lt: to } },
        orderBy: { rating: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.movingRequest.groupBy({
        by: ['fromCityCode'],
        where: requestsIn(from, to),
        orderBy: { _count: { fromCityCode: 'desc' } },
        take: TOP_CITIES,
        _count: { fromCityCode: true },
      }),
      this.prisma.movingRequest.groupBy({
        by: ['fromCityCode'],
        where: { ...requestsIn(from, to), booking: { isNot: null } },
        orderBy: { fromCityCode: 'asc' },
        _count: { _all: true },
      }),
      this.daily(from, days),
    ]);

    const booked = new Map(citiesBooked.map((c) => [c.fromCityCode, c._count._all]));
    const ratingCounts = new Map(ratingRows.map((r) => [r.rating, r._count._all]));
    return {
      period: { days, from: from.toISOString(), to: to.toISOString(), previousFrom: previousFrom.toISOString() },
      totals: { current, previous },
      funnel: {
        ...funnel,
        quotedRate: ratio(funnel.quoted, funnel.requests),
        bookedRate: ratio(funnel.booked, funnel.requests),
        completedRate: ratio(funnel.completed, funnel.booked),
      },
      averages: {
        quotesPerRequest: funnel.requests > 0 ? Math.round((quotesForCohort / funnel.requests) * 10) / 10 : null,
        acceptedPriceTry: accepted._avg.priceTry?.toFixed(0) ?? null,
        acceptedTotalTry: accepted._sum.priceTry?.toFixed(0) ?? '0',
      },
      ratings: {
        count: ratings._count._all,
        average: ratings._avg.rating === null ? null : Math.round(ratings._avg.rating * 100) / 100,
        distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: ratingCounts.get(rating) ?? 0 })),
      },
      cities: cities.map((c) => ({
        code: c.fromCityCode,
        name: getCityByCode(c.fromCityCode)?.name ?? c.fromCityCode,
        requests: c._count.fromCityCode,
        booked: booked.get(c.fromCityCode) ?? 0,
      })),
      daily,
    };
  }

  /** Dönem içinde olan olaylar: önceki dönemle karşılaştırılan kutucuklar */
  private async totals(from: Date, to: Date) {
    const createdIn = { createdAt: { gte: from, lt: to } };
    const [requests, quotes, bookings, completed, customers, companies, verifiedCompanies] = await Promise.all([
      this.prisma.movingRequest.count({ where: requestsIn(from, to) }),
      this.prisma.quote.count({ where: createdIn }),
      this.prisma.booking.count({ where: createdIn }),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED, completedAt: { gte: from, lt: to } } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER, ...createdIn } }),
      this.prisma.company.count({ where: createdIn }),
      this.prisma.company.count({ where: { verifiedAt: { gte: from, lt: to }, deletedAt: null } }),
    ]);
    return { requests, quotes, bookings, completed, customers, companies, verifiedCompanies };
  }

  /** Dönemde açılan taleplerin bugüne kadar nereye ulaştığı (kohort) */
  private async funnel(from: Date, to: Date) {
    const cohort = requestsIn(from, to);
    const [requests, quoted, booked, completed] = await Promise.all([
      this.prisma.movingRequest.count({ where: cohort }),
      this.prisma.movingRequest.count({ where: { ...cohort, quotes: { some: {} } } }),
      this.prisma.movingRequest.count({ where: { ...cohort, booking: { isNot: null } } }),
      this.prisma.movingRequest.count({ where: { ...cohort, booking: { is: { status: BookingStatus.COMPLETED } } } }),
    ]);
    return { requests, quoted, booked, completed };
  }

  /** Günlük talep, teklif ve iş sayıları; gün sınırı Türkiye saatiyle */
  private async daily(from: Date, days: number) {
    type Row = { day: string; count: bigint | number };
    const toRows = (rows: Row[]) => rows.map((r) => ({ day: String(r.day), count: Number(r.count) }));
    const [requests, quotes, bookings] = await Promise.all([
      this.prisma.$queryRaw<Row[]>`
        SELECT DATE_FORMAT(createdAt + INTERVAL 3 HOUR, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM \`MovingRequest\`
        WHERE createdAt >= ${from} AND status <> ${RequestStatus.DRAFT}
        GROUP BY day`,
      this.prisma.$queryRaw<Row[]>`
        SELECT DATE_FORMAT(createdAt + INTERVAL 3 HOUR, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM \`Quote\`
        WHERE createdAt >= ${from}
        GROUP BY day`,
      this.prisma.$queryRaw<Row[]>`
        SELECT DATE_FORMAT(createdAt + INTERVAL 3 HOUR, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM \`Booking\`
        WHERE createdAt >= ${from}
        GROUP BY day`,
    ]);
    const req = fillDays(from, days, toRows(requests));
    const quo = fillDays(from, days, toRows(quotes));
    const boo = fillDays(from, days, toRows(bookings));
    return req.map((r, i) => ({ day: r.day, requests: r.count, quotes: quo[i]!.count, bookings: boo[i]!.count }));
  }
}

const requestsIn = (from: Date, to: Date): Prisma.MovingRequestWhereInput => ({
  createdAt: { gte: from, lt: to },
  status: { not: RequestStatus.DRAFT },
});
