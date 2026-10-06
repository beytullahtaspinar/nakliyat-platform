import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService, serviceArea } from '../companies/companies.service.js';
import { BookingStatus, QuoteStatus, RequestStatus, UserRole } from '../generated/prisma/enums.js';
import { todayInTurkey } from '../media/company-document-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addDays, dayStart } from './calendar-rules.js';
import { monthRange, winRate, WIN_RATE_DAYS } from './company-overview-rules.js';

@ApiTags('Firma: pano')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/overview')
export class CompanyOverviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Firma panelinin ilk sayfası: bekleyen işler ve özet sayılar',
    description: `Günler ve ay Türkiye saatine göredir. Kazanma oranı son ${WIN_RATE_DAYS} günde sonuçlanan teklifler (kabul / kabul + başka firma seçildi + süresi doldu); geri çekilenler sayılmaz. Ciro: iptal edilmeyen işlerin anlaşma tutarı, taşınma gününün ayına göre.`,
  })
  async overview(@CurrentUser() user: AuthUser) {
    const company = await this.companies.requireCompany(user.id);
    const cities = serviceArea(company);
    const own = { companyId: company.id };
    const today = todayInTurkey();
    const thisMonth = monthRange(today);
    const lastMonth = monthRange(addDays(thisMonth.first, -1));
    const sinceWinRate = new Date(Date.now() - WIN_RATE_DAYS * 86_400_000);
    const revenue = (range: { first: string; next: string }) =>
      this.prisma.quote.aggregate({
        where: {
          ...own,
          booking: {
            is: {
              status: { not: BookingStatus.CANCELLED },
              scheduledAt: { gte: dayStart(range.first), lt: dayStart(range.next) },
            },
          },
        },
        _sum: { priceTry: true },
      });

    const [openRequests, notQuoted, quotes, decided, bookings, next7Days, revenueThis, revenueLast] =
      await Promise.all([
        this.prisma.movingRequest.count({
          where: {
            status: RequestStatus.OPEN,
            deletedAt: null,
            expiresAt: { gt: new Date() },
            OR: [{ fromCityCode: { in: cities } }, { toCityCode: { in: cities } }],
          },
        }),
        this.prisma.movingRequest.count({
          where: {
            status: RequestStatus.OPEN,
            deletedAt: null,
            expiresAt: { gt: new Date() },
            OR: [{ fromCityCode: { in: cities } }, { toCityCode: { in: cities } }],
            quotes: { none: own },
          },
        }),
        this.prisma.quote.groupBy({ by: ['status'], where: own, orderBy: { status: 'asc' }, _count: { _all: true } }),
        this.prisma.quote.groupBy({
          by: ['status'],
          where: { ...own, updatedAt: { gte: sinceWinRate }, status: { not: QuoteStatus.WITHDRAWN } },
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.booking.groupBy({ by: ['status'], where: own, orderBy: { status: 'asc' }, _count: { _all: true } }),
        this.prisma.booking.count({
          where: {
            ...own,
            status: BookingStatus.SCHEDULED,
            scheduledAt: { gte: dayStart(today), lt: dayStart(addDays(today, 7)) },
          },
        }),
        revenue(thisMonth),
        revenue(lastMonth),
      ]);

    const count = <K extends string>(rows: { status: K; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<K, number>>;
    const byQuote = count(quotes);
    const byBooking = count(bookings);
    const recent = count(decided);

    return {
      requests: { open: openRequests, notQuoted },
      quotes: {
        pending: byQuote.PENDING ?? 0,
        accepted: byQuote.ACCEPTED ?? 0,
        winRate: winRate(recent),
      },
      bookings: {
        scheduled: byBooking.SCHEDULED ?? 0,
        next7Days,
        completed: byBooking.COMPLETED ?? 0,
        cancelled: byBooking.CANCELLED ?? 0,
      },
      revenue: {
        month: thisMonth.first.slice(0, 7),
        thisMonthTry: Number(revenueThis._sum.priceTry ?? 0),
        lastMonthTry: Number(revenueLast._sum.priceTry ?? 0),
      },
      rating: { average: Number(company.ratingAverage), count: company.ratingCount },
    };
  }
}
