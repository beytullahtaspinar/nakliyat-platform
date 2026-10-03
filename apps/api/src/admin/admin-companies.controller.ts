import {
  BadRequestException,
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
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { toProfile, WITH_CITIES } from '../companies/companies.service.js';
import { UpdateCompanyProfileDto } from '../companies/dto/company-profile.dto.js';
import { assertCityCodes } from '../common/utils/locations.js';
import type { Prisma } from '../generated/prisma/client.js';
import { DomainEvents } from '../events/domain-events.js';
import { UserRole, UserStatus, VerificationStatus } from '../generated/prisma/enums.js';
import { CompanyDocumentsService } from '../media/company-documents.service.js';
import { CompanyShowcaseService } from '../media/company-showcase.service.js';
import { HideShowcaseMediaDto } from '../media/dto/company-showcase.dto.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListCompaniesDto, RejectCompanyDto } from './dto/admin-companies.dto.js';
import { phoneDigits } from './dto/admin-lists.dto.js';

/** Firma paneli görüntüleme süresi: 30 dk, sonra yönetici kendi oturumuna döner */
const IMPERSONATION_TTL_SECONDS = 30 * 60;

@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly documents: CompanyDocumentsService,
    private readonly showcase: CompanyShowcaseService,
    private readonly companies: CompaniesService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Yönetici firmanın panelini firmanın gözünden açar; firmanın şifresi gerekmez.
   * Yalnızca kısa ömürlü bir erişim anahtarı verilir (yenileme anahtarı yok). Geçiş ve bu anahtarla
   * yapılan her değişiklik, yönetici adına firmanın geçmişine yazılır.
   */
  @Post(':id/impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, displayName: true, owner: { select: { id: true, role: true, status: true, deletedAt: true } } },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const { owner } = company;
    if (owner.deletedAt || owner.role !== UserRole.COMPANY) throw new NotFoundException('Firma bulunamadı');
    if (owner.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Firmanın hesabı askıya alınmış. Paneline geçmek için önce hesabı etkinleştirin.');
    }

    const payload: AccessTokenPayload = { sub: owner.id, role: owner.role, imp: admin.id };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: IMPERSONATION_TTL_SECONDS });
    await this.prisma.auditLog.create({
      data: { actorId: admin.id, action: 'company.impersonate', entityType: 'Company', entityId: id },
    });
    return {
      accessToken,
      expiresIn: IMPERSONATION_TTL_SECONDS,
      company: { id: company.id, displayName: company.displayName },
    };
  }

  @Get()
  async list(@Query() { status, q, page, limit }: ListCompaniesDto) {
    const digits = phoneDigits(q);
    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(status && { verificationStatus: status }),
      ...(q && {
        OR: [
          { displayName: { contains: q } },
          { legalName: { contains: q } },
          { taxNumber: { contains: q } },
          { k3LicenseNumber: { contains: q } },
          { owner: { fullName: { contains: q } } },
          ...(digits ? [{ owner: { phone: { contains: digits } } }] : []),
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        // Onay kuyruğunda en eski başvuru önce, diğer listelerde en yeni kayıt önce
        orderBy: { createdAt: status === VerificationStatus.PENDING ? 'asc' : 'desc' },
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
    const { owner, _count, ...rest } = company;
    return {
      ...toProfile(rest),
      owner,
      ...(await this.documents.summary(id)),
      media: await this.showcase.listForAdmin(id),
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
    if (changed.includes('description')) await this.companies.refreshShowcaseComplete(id);
    return toProfile(updated);
  }

  /** Uygunsuz logo/fotoğrafı herkese açık sayfadan kaldırır; gerekçe firma panelinde görünür */
  @Post(':id/media/:mediaId/hide')
  @HttpCode(HttpStatus.OK)
  hideMedia(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: HideShowcaseMediaDto,
  ) {
    return this.showcase.setHidden(admin.id, id, mediaId, dto.reason);
  }

  @Post(':id/media/:mediaId/unhide')
  @HttpCode(HttpStatus.OK)
  unhideMedia(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.showcase.setHidden(admin.id, id, mediaId, null);
  }

  /** Zorunlu belgelerin (K3, vergi levhası, ticaret sicil) her biri onaylanmış ve süresi geçerli olmalı */
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const missing = await this.documents.missingForVerification(id);
    if (missing.length) {
      throw new ConflictException(`Firma onaylanamaz, şu belgeler onaylanmadı: ${missing.join(', ')}`);
    }
    return this.setStatus(admin, id, VerificationStatus.VERIFIED);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectCompanyDto) {
    return this.setStatus(admin, id, VerificationStatus.REJECTED, dto.reason);
  }

  @Post(':id/documents/:documentId/approve')
  @HttpCode(HttpStatus.OK)
  approveDocument(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Param('documentId') documentId: string) {
    return this.documents.review(admin.id, id, documentId, VerificationStatus.VERIFIED);
  }

  /** Gerekçe firma panelinde belgenin yanında gösterilir */
  @Post(':id/documents/:documentId/reject')
  @HttpCode(HttpStatus.OK)
  rejectDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: RejectCompanyDto,
  ) {
    return this.documents.review(admin.id, id, documentId, VerificationStatus.REJECTED, dto.reason);
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
