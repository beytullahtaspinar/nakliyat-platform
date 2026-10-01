import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminListUsersDto } from './dto/admin-lists.dto.js';

@ApiTags('Admin: kullanıcılar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Kullanıcılar, en yenisi önce. Şifre özeti ve anahtarlar hiç seçilmez. */
  @Get()
  async list(@Query() { role, q, page, limit }: AdminListUsersDto) {
    const digits = q?.replace(/\D/g, '').replace(/^0/, '');
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(q && {
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          ...(digits && digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          role: true,
          status: true,
          fullName: true,
          phone: true,
          email: true,
          phoneVerifiedAt: true,
          createdAt: true,
          company: { select: { id: true, displayName: true, verificationStatus: true } },
          _count: { select: { requests: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...u }) => ({ ...u, requestCount: _count.requests })),
      total,
      page,
      limit,
    };
  }
}
