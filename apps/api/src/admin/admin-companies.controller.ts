import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { toProfile } from '../companies/companies.service.js';
import { UserRole, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListCompaniesDto, RejectCompanyDto } from './dto/admin-companies.dto.js';

@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() { status, page, limit }: ListCompaniesDto) {
    const where = { deletedAt: null, ...(status && { verificationStatus: status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: { select: { fullName: true, phone: true, email: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);
    return {
      items: items.map(({ owner, ...c }) => ({ ...toProfile(c), owner })),
      total,
      page,
      limit,
    };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.setStatus(admin, id, VerificationStatus.VERIFIED);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectCompanyDto) {
    return this.setStatus(admin, id, VerificationStatus.REJECTED, dto.reason);
  }

  private async setStatus(admin: AuthUser, id: string, status: VerificationStatus, note?: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Firma bulunamadı');

    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        data: {
          verificationStatus: status,
          verifiedAt: status === VerificationStatus.VERIFIED ? new Date() : null,
          verificationNote: note ?? null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: status === VerificationStatus.VERIFIED ? 'company.verify' : 'company.reject',
          entityType: 'Company',
          entityId: id,
          details: { from: company.verificationStatus, to: status, note: note ?? null },
        },
      }),
    ]);
    return toProfile(updated);
  }
}
