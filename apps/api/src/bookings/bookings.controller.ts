import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService, toPublicCompany } from '../companies/companies.service.js';
import type { MovingRequest, Review } from '../generated/prisma/client.js';
import { BookingStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { moveDayReached } from '../reviews/review-rules.js';
import { toReviewView } from '../reviews/reviews.service.js';

const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  return { cityName: city?.name ?? null, districtName: (city && getDistrict(city, districtSlug)?.name) ?? null };
};

/** Anlaşma sonrası taraflar birbirinin iletişim ve adres bilgisini görür. */
const point = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null);
/** Değerlendirme ve "iş tamamlandı" düğmesi için ortak alanlar */
const reviewState = (b: { status: BookingStatus; scheduledAt: Date; review: Review | null }) => ({
  canComplete: b.status === BookingStatus.SCHEDULED && moveDayReached(b.scheduledAt),
  review: b.review && toReviewView(b.review),
});

const fullRequest = (r: MovingRequest) => ({
  id: r.id,
  from: {
    ...place(r.fromCityCode, r.fromDistrict),
    address: r.fromAddress,
    floor: r.fromFloor,
    hasElevator: r.fromHasElevator,
    location: point(r.fromLat, r.fromLng),
  },
  to: {
    ...place(r.toCityCode, r.toDistrict),
    address: r.toAddress,
    floor: r.toFloor,
    hasElevator: r.toHasElevator,
    location: point(r.toLat, r.toLng),
  },
  routeKm: r.routeKm,
  routeMinutes: r.routeMinutes,
  homeType: r.homeType,
  moveDate: r.moveDate,
  notes: r.notes,
});

@ApiTags('Anlaşılan işler')
@ApiBearerAuth()
@Controller()
export class BookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  @Roles(UserRole.COMPANY)
  @Get('company/bookings')
  async companyBookings(@CurrentUser() user: AuthUser, @Query() { page, limit }: PaginationDto) {
    const company = await this.companies.requireCompany(user.id);
    const where = { companyId: company.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { quote: true, review: true, request: { include: { customer: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map(({ request, quote, review, ...b }) => ({
        ...b,
        ...reviewState({ ...b, review }),
        priceTry: quote.priceTry,
        request: fullRequest(request),
        customer: { fullName: request.customer.fullName, phone: request.customer.phone },
      })),
      total,
      page,
      limit,
    };
  }

  @Roles(UserRole.CUSTOMER)
  @Get('bookings')
  async customerBookings(@CurrentUser() user: AuthUser, @Query() { page, limit }: PaginationDto) {
    const where = { request: { customerId: user.id } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { quote: true, review: true, request: true, company: { include: { owner: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map(({ request, quote, company, review, ...b }) => ({
        ...b,
        ...reviewState({ ...b, review }),
        priceTry: quote.priceTry,
        request: fullRequest(request),
        company: {
          ...toPublicCompany(company),
          contactName: company.owner.fullName,
          contactPhone: company.owner.phone,
        },
      })),
      total,
      page,
      limit,
    };
  }
}
