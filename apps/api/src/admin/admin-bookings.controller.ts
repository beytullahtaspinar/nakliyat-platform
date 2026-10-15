import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BookingStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminListDisputesDto, ResolveDisputeDto } from '../reviews/dto/review.dto.js';
import { ReviewsService } from '../reviews/reviews.service.js';

const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  const district = city && getDistrict(city, districtSlug);
  return district ? `${city.name}, ${district.name}` : (city?.name ?? cityCode);
};

@ApiTags('Admin: itirazlar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  /** "Taşınma yapılmadı" itirazları: bekleyenler (eskisi önce) ya da sonuçlananlar (yenisi önce) */
  @Get('disputes')
  async disputes(@Query() { status, page, limit }: AdminListDisputesDto) {
    const where: Prisma.BookingWhereInput =
      status === 'open'
        ? { disputedAt: { not: null }, status: BookingStatus.SCHEDULED }
        : { disputedAt: { not: null }, status: { not: BookingStatus.SCHEDULED } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: status === 'open' ? { disputedAt: 'asc' } : { disputeResolvedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quote: { select: { priceTry: true } },
          request: { include: { customer: { select: { id: true, fullName: true, phone: true } } } },
          company: { select: { id: true, displayName: true, owner: { select: { phone: true } } } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((b) => ({
        id: b.id,
        requestId: b.requestId,
        status: b.status,
        scheduledAt: b.scheduledAt,
        priceTry: b.quote.priceTry,
        from: place(b.request.fromCityCode, b.request.fromDistrict),
        to: place(b.request.toCityCode, b.request.toDistrict),
        customer: b.request.customer,
        company: { id: b.company.id, displayName: b.company.displayName, phone: b.company.owner.phone },
        disputedAt: b.disputedAt,
        disputedBy: b.disputedBy,
        disputeReason: b.disputeReason,
        disputeResolvedAt: b.disputeResolvedAt,
        disputeResolution: b.disputeResolution,
        messageCount: b._count.messages,
      })),
      total,
      page,
      limit,
    };
  }

  /** İtirazı karara bağlar: taşınma yapıldıysa iş tamamlanır, yapılmadıysa iptal edilir; iki tarafa bildirim gider */
  @Post(':id/resolve-dispute')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.reviews.resolveDispute(admin.id, id, dto.decision, dto.note);
  }
}
