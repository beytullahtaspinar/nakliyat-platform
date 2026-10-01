import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { toProfile, WITH_CITIES } from '../companies/companies.service.js';
import { UpdateCompanyProfileDto } from '../companies/dto/company-profile.dto.js';
import { assertCityCodes } from '../common/utils/locations.js';
import { DomainEvents } from '../events/domain-events.js';
import { UserRole, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListCompaniesDto, RejectCompanyDto } from './dto/admin-companies.dto.js';

@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  @Get()
  async list(@Query() { status, page, limit }: ListCompaniesDto) {
    const where = { deletedAt: null, ...(status && { verificationStatus: status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { ...WITH_CITIES, owner: { select: { fullName: true, phone: true, email: true } } },
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

  /** İnceleme ekranı: firma, sahibi, belgeleri ve geçmiş doğrulama kararları */
  @Get(':id')
  async detail(@Param('id') id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...WITH_CITIES,
        owner: { select: { id: true, fullName: true, phone: true, email: true, createdAt: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { quotes: true, bookings: true } },
      },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const history = await this.prisma.auditLog.findMany({
      where: { entityType: 'Company', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, details: true, createdAt: true, actor: { select: { fullName: true } } },
    });
    const { owner, documents, _count, ...rest } = company;
    return {
      ...toProfile(rest),
      owner,
      documents,
      quoteCount: _count.quotes,
      bookingCount: _count.bookings,
      history,
    };
  }

  /**
   * Firma bilgilerini düzeltir. Firmanın kendi düzenlemesinden farkı: kimlik alanları değişse de
   * doğrulama durumu korunur (kontrolü yapan zaten yönetici).
   */
  @Patch(':id')
  async update(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: UpdateCompanyProfileDto) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null }, include: WITH_CITIES });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const cityCode = dto.cityCode ?? company.cityCode;
    assertCityCodes([cityCode, ...(dto.serviceCityCodes ?? [])], 'İl');
    if (dto.taxNumber && dto.taxNumber !== company.taxNumber) {
      const taken = await this.prisma.company.findUnique({ where: { taxNumber: dto.taxNumber } });
      if (taken) throw new ConflictException('Bu vergi numarasıyla kayıtlı başka bir firma var');
    }

    const { serviceCityCodes, ...fields } = dto;
    const changed: string[] = (Object.keys(fields) as (keyof typeof fields)[]).filter(
      (k) => fields[k] !== undefined && fields[k] !== (company[k] ?? undefined),
    );
    const services = serviceCityCodes && [...new Set([cityCode, ...serviceCityCodes])].sort();
    const current = company.serviceCities.map((c) => c.cityCode).sort();
    const servicesChanged = services !== undefined && services.join() !== current.join();
    if (servicesChanged) changed.push('serviceCityCodes');
    if (changed.length === 0) return toProfile(company);

    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        include: WITH_CITIES,
        data: {
          ...fields,
          ...(servicesChanged && {
            serviceCities: { deleteMany: {}, create: services.map((code) => ({ cityCode: code })) },
          }),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'company.update',
          entityType: 'Company',
          entityId: id,
          details: { fields: changed },
        },
      }),
    ]);
    return toProfile(updated);
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
        include: WITH_CITIES,
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
    if (company.verificationStatus !== status) {
      this.events.emit('company.verification_changed', { companyId: id });
    }
    return toProfile(updated);
  }
}
