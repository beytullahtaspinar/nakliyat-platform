import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toRequestResponse } from '../requests/requests.service.js';
import { AdminListRequestsDto, phoneDigits } from './dto/admin-lists.dto.js';

const CUSTOMER = { select: { id: true, fullName: true, phone: true, email: true } } as const;

@ApiTags('Admin: talepler')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/requests')
export class AdminRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /** Tüm taşıma talepleri, en yenisi önce; müşteri iletişim bilgisiyle */
  @Get()
  async list(@Query() { status, q, page, limit }: AdminListRequestsDto) {
    const digits = phoneDigits(q);
    const where: Prisma.MovingRequestWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(q && {
        customer: {
          OR: [{ fullName: { contains: q } }, ...(digits ? [{ phone: { contains: digits } }] : [])],
        },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.movingRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { quotes: true } }, customer: CUSTOMER },
      }),
      this.prisma.movingRequest.count({ where }),
    ]);
    return {
      items: items.map(({ _count, customer, ...r }) => ({ ...toRequestResponse(r, _count.quotes), customer })),
      total,
      page,
      limit,
    };
  }

  /** Talep kaydı: adresler, müşteri, gelen teklifler (fiyata göre) ve varsa iş */
  @Get(':id')
  async detail(@Param('id') id: string) {
    const request = await this.prisma.movingRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: CUSTOMER,
        quotes: {
          orderBy: { priceTry: 'asc' },
          include: { company: { select: { id: true, displayName: true, verificationStatus: true } } },
        },
        booking: { select: { id: true, status: true, scheduledAt: true, completedAt: true, cancelledAt: true, cancelReason: true } },
      },
    });
    if (!request) throw new NotFoundException('Talep bulunamadı');
    const { customer, quotes, booking, ...r } = request;
    return {
      ...toRequestResponse(r, quotes.length),
      customer,
      booking,
      media: await this.media.listForRequest(r.id),
      quotes: quotes.map((q) => ({
        id: q.id,
        status: q.status,
        priceTry: q.priceTry,
        crewSize: q.crewSize,
        vehicleType: q.vehicleType,
        includesPacking: q.includesPacking,
        includesAssembly: q.includesAssembly,
        includesInsurance: q.includesInsurance,
        message: q.message,
        validUntil: q.validUntil,
        createdAt: q.createdAt,
        company: q.company,
      })),
    };
  }
}
