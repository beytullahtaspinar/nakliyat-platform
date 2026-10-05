import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService, toPublicCompany } from '../companies/companies.service.js';
import type { MovingRequest, Review } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { BookingStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { addDays, dayStart, MAX_CALENDAR_DAYS } from './calendar-rules.js';
import { CalendarRangeDto } from './dto/calendar.dto.js';
import { CompanyBookingsQueryDto, CompanySearchDto } from './dto/company-bookings.dto.js';
import { moveDayPassed, moveDayReached } from '../reviews/review-rules.js';
import { toReviewView } from '../reviews/reviews.service.js';

const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  return { cityName: city?.name ?? null, districtName: (city && getDistrict(city, districtSlug)?.name) ?? null };
};

/** Anlaşma sonrası taraflar birbirinin iletişim ve adres bilgisini görür. */
const point = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null);
/** Değerlendirme, "iş tamamlandı" ve "işi iptal et" düğmeleri için ortak alanlar */
const reviewState = (b: { status: BookingStatus; scheduledAt: Date; review: Review | null }) => ({
  canComplete: b.status === BookingStatus.SCHEDULED && moveDayReached(b.scheduledAt),
  canCancel: b.status === BookingStatus.SCHEDULED && !moveDayPassed(b.scheduledAt),
  review: b.review && toReviewView(b.review),
});

const COMPANY_BOOKING = {
  quote: true,
  review: true,
  request: { include: { customer: true } },
} satisfies Prisma.BookingInclude;

/** Firmaya gösterilen iş: anlaşma sonrası müşterinin adı, telefonu ve açık adresi açılır */
const toCompanyBooking = ({
  request,
  quote,
  review,
  ...b
}: Prisma.BookingGetPayload<{ include: typeof COMPANY_BOOKING }>) => ({
  ...b,
  ...reviewState({ ...b, review }),
  priceTry: quote.priceTry,
  request: fullRequest(request),
  customer: { fullName: request.customer.fullName, phone: request.customer.phone },
});

/** Müşteri adı ya da telefonunda arama; telefon yazılışındaki boşluk ve parantezler atılır */
function customerSearch(q?: string): Prisma.BookingWhereInput {
  const text = q?.trim();
  if (!text) return {};
  // "0532 ..." yazılsa da kayıtlı "+90532..." ile eşleşsin: baştaki 0 atılır
  const digits = text.replace(/\D/g, '').replace(/^0/, '');
  return {
    request: {
      customer: {
        OR: [{ fullName: { contains: text } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])],
      },
    },
  };
}

type CompanyCustomer = {
  fullName: string;
  phone: string;
  bookingCount: number;
  /** Planlanmış (henüz yapılmamış) iş sayısı */
  activeCount: number;
  /** İptal edilmeyen işlerin anlaşma tutarı toplamı (TL) */
  totalTry: number;
  lastBooking: {
    id: string;
    status: BookingStatus;
    scheduledAt: Date;
    from: ReturnType<typeof place>;
    to: ReturnType<typeof place>;
  };
};

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
  @ApiOperation({
    summary: 'Firmanın işleri',
    description:
      'Yaklaşan (SCHEDULED) işler ve süzgeçsiz liste taşınma gününe göre eskiden yeniye, tamamlanan ve iptal edilenler yeniden eskiye sıralanır. q: müşteri adı ya da telefonu.',
  })
  async companyBookings(@CurrentUser() user: AuthUser, @Query() { page, limit, status, q }: CompanyBookingsQueryDto) {
    const company = await this.companies.requireCompany(user.id);
    const where: Prisma.BookingWhereInput = {
      companyId: company.id,
      ...(status && { status }),
      ...customerSearch(q),
    };
    const newestFirst = status === BookingStatus.COMPLETED || status === BookingStatus.CANCELLED;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ scheduledAt: newestFirst ? 'desc' : 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: COMPANY_BOOKING,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: items.map(toCompanyBooking), total, page, limit };
  }

  @Roles(UserRole.COMPANY)
  @Get('company/customers')
  @ApiOperation({
    summary: 'Firmanın müşterileri',
    description: 'Teklifi kabul edilen müşteriler: iş sayısı, son taşınma ve iptal edilmeyen işlerin toplamı. En son taşınan önce.',
  })
  async companyCustomers(@CurrentUser() user: AuthUser, @Query() { page, limit, q }: CompanySearchDto) {
    const company = await this.companies.requireCompany(user.id);
    // Firma başına iş sayısı küçük (yüzlerle sınırlı); gruplama bellekte yapılır
    const bookings = await this.prisma.booking.findMany({
      where: { companyId: company.id, ...customerSearch(q) },
      orderBy: { scheduledAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        quote: { select: { priceTry: true } },
        request: {
          select: {
            customerId: true,
            fromCityCode: true,
            fromDistrict: true,
            toCityCode: true,
            toDistrict: true,
            customer: { select: { fullName: true, phone: true } },
          },
        },
      },
    });
    const customers = new Map<string, CompanyCustomer>();
    for (const b of bookings) {
      const key = b.request.customerId;
      let c = customers.get(key);
      if (!c) {
        // İlk görülen iş en son taşınma (azalan sıralı)
        c = {
          fullName: b.request.customer.fullName,
          phone: b.request.customer.phone,
          bookingCount: 0,
          activeCount: 0,
          totalTry: 0,
          lastBooking: {
            id: b.id,
            status: b.status,
            scheduledAt: b.scheduledAt,
            from: place(b.request.fromCityCode, b.request.fromDistrict),
            to: place(b.request.toCityCode, b.request.toDistrict),
          },
        };
        customers.set(key, c);
      }
      c.bookingCount += 1;
      if (b.status === BookingStatus.SCHEDULED) c.activeCount += 1;
      if (b.status !== BookingStatus.CANCELLED) c.totalTry += Number(b.quote.priceTry);
    }
    const all = [...customers.values()];
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
  }

  @Roles(UserRole.COMPANY)
  @Get('company/bookings/calendar')
  @ApiOperation({
    summary: 'Firmanın takvimi: verilen günler arasındaki işler (iki uç dahil, en fazla 42 gün)',
    description: 'Günler Türkiye saatine göredir; scheduledAt taşınma gününü gösterir. İptal edilen işler de döner (takvimde soluk gösterilir).',
  })
  async companyCalendar(@CurrentUser() user: AuthUser, @Query() { from, to }: CalendarRangeDto) {
    if (to < from) throw new BadRequestException('Bitiş günü başlangıçtan önce olamaz');
    if (to > addDays(from, MAX_CALENDAR_DAYS - 1)) {
      throw new BadRequestException(`Takvim en fazla ${MAX_CALENDAR_DAYS} gün için istenebilir`);
    }
    const company = await this.companies.requireCompany(user.id);
    const items = await this.prisma.booking.findMany({
      where: { companyId: company.id, scheduledAt: { gte: dayStart(from), lt: dayStart(addDays(to, 1)) } },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: 500,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        quote: { select: { priceTry: true } },
        request: {
          select: {
            homeType: true,
            fromCityCode: true,
            fromDistrict: true,
            toCityCode: true,
            toDistrict: true,
            customer: { select: { fullName: true } },
          },
        },
      },
    });
    return {
      from,
      to,
      items: items.map(({ quote, request: r, ...b }) => ({
        ...b,
        day: b.scheduledAt.toISOString().slice(0, 10),
        priceTry: quote.priceTry,
        homeType: r.homeType,
        from: place(r.fromCityCode, r.fromDistrict),
        to: place(r.toCityCode, r.toDistrict),
        customerName: r.customer.fullName,
      })),
    };
  }

  @Roles(UserRole.COMPANY)
  @Get('company/bookings/:id')
  async companyBooking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const company = await this.companies.requireCompany(user.id);
    const booking = await this.prisma.booking.findFirst({ where: { id, companyId: company.id }, include: COMPANY_BOOKING });
    if (!booking) throw new NotFoundException('İş bulunamadı');
    return toCompanyBooking(booking);
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
