import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import type { MovingRequest, Quote } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { QuoteStatus, RequestStatus } from '../generated/prisma/enums.js';
import {
  CompaniesService,
  toPublicCompany,
  type CompanyWithCities,
} from '../companies/companies.service.js';
import { DomainEvents } from '../events/domain-events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../requests/dto/list-requests.dto.js';
import type { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto.js';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly events: DomainEvents,
  ) {}

  // ─── Firma tarafı ─────────────────────────────────────────────

  /** Firmanın hizmet bölgesindeki açık talepler. Müşteri kimliği ve açık adres gizli. */
  async listOpenRequestsForCompany(ownerId: string, { page, limit }: PaginationDto) {
    const company = await this.companies.requireCompany(ownerId);
    const cities = serviceArea(company);
    const where: Prisma.MovingRequestWhereInput = {
      status: RequestStatus.OPEN,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      OR: [{ fromCityCode: { in: cities } }, { toCityCode: { in: cities } }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.movingRequest.findMany({
        where,
        orderBy: { moveDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quotes: { where: { companyId: company.id } },
          _count: { select: { quotes: true } },
        },
      }),
      this.prisma.movingRequest.count({ where }),
    ]);
    return {
      items: items.map(({ quotes, _count, ...r }) => ({
        ...toCompanyRequestView(r),
        quoteCount: _count.quotes,
        myQuote: quotes[0] ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getRequestForCompany(ownerId: string, requestId: string) {
    const company = await this.companies.requireCompany(ownerId);
    const request = await this.prisma.movingRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
        OR: [
          { fromCityCode: { in: serviceArea(company) } },
          { toCityCode: { in: serviceArea(company) } },
        ],
      },
      include: { quotes: { where: { companyId: company.id } }, _count: { select: { quotes: true } } },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    const { quotes, _count, ...r } = request;
    return { ...toCompanyRequestView(r), quoteCount: _count.quotes, myQuote: quotes[0] ?? null };
  }

  async createQuote(ownerId: string, requestId: string, dto: CreateQuoteDto) {
    const company = await this.companies.requireVerifiedCompany(ownerId);
    const request = await this.prisma.movingRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
        OR: [
          { fromCityCode: { in: serviceArea(company) } },
          { toCityCode: { in: serviceArea(company) } },
        ],
      },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    assertAcceptingQuotes(request);
    const validUntil = resolveValidUntil(dto.validUntil, request);

    try {
      const quote = await this.prisma.quote.create({
        data: {
          ...dto,
          validUntil,
          requestId,
          companyId: company.id,
          revisions: { create: { priceTry: dto.priceTry } },
        },
      });
      this.events.emit('quote.created', { quoteId: quote.id });
      return quote;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu talebe zaten teklif verdiniz; mevcut teklifinizi güncelleyebilirsiniz');
      }
      throw e;
    }
  }

  async updateQuote(ownerId: string, quoteId: string, dto: UpdateQuoteDto) {
    const { quote, request } = await this.findOwnQuote(ownerId, quoteId);
    if (quote.status !== QuoteStatus.PENDING) {
      throw new ConflictException('Yalnızca bekleyen teklifler güncellenebilir');
    }
    assertAcceptingQuotes(request);
    const validUntil = dto.validUntil ? resolveValidUntil(dto.validUntil, request) : undefined;
    const priceChanged = dto.priceTry !== undefined && !quote.priceTry.equals(dto.priceTry);

    return this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        ...dto,
        ...(validUntil && { validUntil }),
        ...(priceChanged && { revisions: { create: { priceTry: dto.priceTry! } } }),
      },
    });
  }

  async withdrawQuote(ownerId: string, quoteId: string) {
    const { quote } = await this.findOwnQuote(ownerId, quoteId);
    if (quote.status !== QuoteStatus.PENDING) {
      throw new ConflictException('Yalnızca bekleyen teklifler geri çekilebilir');
    }
    return this.prisma.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.WITHDRAWN },
    });
  }

  async listCompanyQuotes(ownerId: string, { page, limit }: PaginationDto) {
    const company = await this.companies.requireCompany(ownerId);
    const where = { companyId: company.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { request: true },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return {
      items: items.map(({ request, ...q }) => ({ ...q, request: toCompanyRequestView(request) })),
      total,
      page,
      limit,
    };
  }

  // ─── Müşteri tarafı ───────────────────────────────────────────

  async listQuotesForCustomer(customerId: string, requestId: string) {
    const request = await this.prisma.movingRequest.findFirst({
      where: { id: requestId, customerId, deletedAt: null },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    const quotes = await this.prisma.quote.findMany({
      where: { requestId, status: { not: QuoteStatus.WITHDRAWN } },
      orderBy: { priceTry: 'asc' },
      include: { company: true },
    });
    const now = new Date();
    return quotes.map(({ company, ...q }) => ({
      ...q,
      isExpired: q.validUntil < now,
      company: toPublicCompany(company),
    }));
  }

  /**
   * Teklifi kabul eder: iş (booking) oluşur, talep BOOKED olur, diğer teklifler reddedilir.
   * Aynı anda iki teklifin kabulü, talep durumunun koşullu güncellenmesiyle engellenir.
   */
  async acceptQuote(customerId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, request: { customerId, deletedAt: null } },
      include: { request: true, company: { include: { owner: true } } },
    });
    if (!quote) throw new NotFoundException('Teklif bulunamadı');
    if (quote.status !== QuoteStatus.PENDING) {
      throw new ConflictException('Bu teklif artık kabul edilemez');
    }
    if (quote.validUntil < new Date()) {
      throw new ConflictException('Teklifin geçerlilik süresi dolmuş');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.movingRequest.updateMany({
        where: { id: quote.requestId, status: RequestStatus.OPEN },
        data: { status: RequestStatus.BOOKED },
      });
      if (locked.count !== 1) {
        throw new ConflictException('Bu talep için zaten bir teklif kabul edilmiş veya talep kapanmış');
      }
      await tx.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.ACCEPTED } });
      await tx.quote.updateMany({
        where: { requestId: quote.requestId, id: { not: quote.id }, status: QuoteStatus.PENDING },
        data: { status: QuoteStatus.REJECTED },
      });
      return tx.booking.create({
        data: {
          requestId: quote.requestId,
          quoteId: quote.id,
          companyId: quote.companyId,
          scheduledAt: quote.request.moveDate,
        },
      });
    });
    this.events.emit('quote.accepted', { quoteId: quote.id, bookingId: booking.id });

    return {
      booking,
      company: {
        ...toPublicCompany(quote.company),
        // İletişim bilgisi yalnızca kabulden sonra açılır
        contactName: quote.company.owner.fullName,
        contactPhone: quote.company.owner.phone,
      },
    };
  }

  private async findOwnQuote(ownerId: string, quoteId: string) {
    const company = await this.companies.requireCompany(ownerId);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId: company.id },
      include: { request: true },
    });
    if (!quote) throw new NotFoundException('Teklif bulunamadı');
    const { request, ...rest } = quote;
    return { quote: rest as Quote, request };
  }
}

const serviceArea = (company: CompanyWithCities) => [
  ...new Set([company.cityCode, ...company.serviceCities.map((c) => c.cityCode)]),
];

function assertAcceptingQuotes(request: MovingRequest) {
  if (request.status !== RequestStatus.OPEN || request.expiresAt < new Date()) {
    throw new ConflictException('Bu talep artık teklif kabul etmiyor');
  }
}

function resolveValidUntil(requested: Date | undefined, request: MovingRequest): Date {
  if (!requested) return request.expiresAt;
  if (requested <= new Date()) throw new BadRequestException('Geçerlilik tarihi gelecekte olmalı');
  return requested > request.expiresAt ? request.expiresAt : requested;
}

/** Firmaya gösterilen talep: müşteri kimliği ve açık adres yok, sadece il/ilçe. */
function toCompanyRequestView(request: MovingRequest) {
  const from = getCityByCode(request.fromCityCode);
  const to = getCityByCode(request.toCityCode);
  return {
    id: request.id,
    status: request.status,
    fromCityCode: request.fromCityCode,
    fromCityName: from?.name ?? null,
    fromDistrictName: (from && getDistrict(from, request.fromDistrict)?.name) ?? null,
    fromFloor: request.fromFloor,
    fromHasElevator: request.fromHasElevator,
    toCityCode: request.toCityCode,
    toCityName: to?.name ?? null,
    toDistrictName: (to && getDistrict(to, request.toDistrict)?.name) ?? null,
    toFloor: request.toFloor,
    toHasElevator: request.toHasElevator,
    homeType: request.homeType,
    moveDate: request.moveDate,
    isDateFlexible: request.isDateFlexible,
    needsPacking: request.needsPacking,
    needsAssembly: request.needsAssembly,
    needsStorage: request.needsStorage,
    specialItems: request.specialItems,
    notes: request.notes,
    estimatedVolumeM3: request.estimatedVolumeM3,
    estimatedCrew: request.estimatedCrew,
    estimatedHours: request.estimatedHours,
    distanceKm: request.distanceKm,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
  };
}
