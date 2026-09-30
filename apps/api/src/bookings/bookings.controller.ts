import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService, toPublicCompany } from '../companies/companies.service.js';
import type { MovingRequest } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';

const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  return { cityName: city?.name ?? null, districtName: (city && getDistrict(city, districtSlug)?.name) ?? null };
};

/** Anlaşma sonrası taraflar birbirinin iletişim ve adres bilgisini görür. */
const fullRequest = (r: MovingRequest) => ({
  id: r.id,
  from: { ...place(r.fromCityCode, r.fromDistrict), address: r.fromAddress, floor: r.fromFloor, hasElevator: r.fromHasElevator },
  to: { ...place(r.toCityCode, r.toDistrict), address: r.toAddress, floor: r.toFloor, hasElevator: r.toHasElevator },
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
        include: { quote: true, request: { include: { customer: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map(({ request, quote, ...b }) => ({
        ...b,
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
        include: { quote: true, request: true, company: { include: { owner: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map(({ request, quote, company, ...b }) => ({
        ...b,
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
