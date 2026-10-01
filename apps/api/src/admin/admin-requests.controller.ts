import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toRequestResponse } from '../requests/requests.service.js';
import { AdminListRequestsDto } from './dto/admin-lists.dto.js';

@ApiTags('Admin: talepler')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/requests')
export class AdminRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Tüm taşıma talepleri, en yenisi önce; müşteri iletişim bilgisiyle */
  @Get()
  async list(@Query() { status, page, limit }: AdminListRequestsDto) {
    const where = { deletedAt: null, ...(status && { status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.movingRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { quotes: true } },
          customer: { select: { id: true, fullName: true, phone: true } },
        },
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
}
