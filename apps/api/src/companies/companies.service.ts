import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Company, Prisma } from '../generated/prisma/client.js';
import { CompanyDocumentType, CompanyMediaKind, UserStatus, VerificationStatus } from '../generated/prisma/enums.js';
import { assertNoContactInfo, isShowcaseComplete } from './showcase-rules.js';
import { isExpired } from '../media/company-document-rules.js';
import { assertCityCodes, cityName } from '../common/utils/locations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateCompanyProfileDto,
  UpdateCompanyProfileDto,
} from './dto/company-profile.dto.js';

export const WITH_CITIES = { serviceCities: { select: { cityCode: true } } } satisfies Prisma.CompanyInclude;
export type CompanyWithCities = Company & { serviceCities: { cityCode: string }[] };

/** Herkese açık sayfada gösterilebilen firma: doğrulanmış, silinmemiş, sahibi askıda değil */
export const PUBLIC_COMPANY = {
  verificationStatus: VerificationStatus.VERIFIED,
  deletedAt: null,
  owner: { deletedAt: null, status: UserStatus.ACTIVE },
} satisfies Prisma.CompanyWhereInput;

/** Değişirse firmanın yeniden doğrulanması gereken alanlar */
const IDENTITY_FIELDS = ['legalName', 'taxNumber', 'k3LicenseNumber'] as const;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateCompanyProfileDto) {
    assertCityCodes([dto.cityCode, ...dto.serviceCityCodes], 'İl');
    assertNoContactInfo(dto.description, 'Tanıtım yazısı');
    if (await this.prisma.company.findUnique({ where: { ownerId } })) {
      throw new ConflictException('Bu hesaba ait bir firma profili zaten var');
    }
    if (await this.prisma.company.findUnique({ where: { taxNumber: dto.taxNumber } })) {
      throw new ConflictException('Bu vergi numarasıyla kayıtlı bir firma var');
    }
    const { serviceCityCodes, ...fields } = dto;
    const company = await this.prisma.company.create({
      data: {
        ...fields,
        ownerId,
        serviceCities: { create: unique(serviceCityCodes).map((cityCode) => ({ cityCode })) },
      },
      include: WITH_CITIES,
    });
    return toProfile(company);
  }

  async getOwn(ownerId: string) {
    return toProfile(await this.requireCompany(ownerId));
  }

  async update(ownerId: string, dto: UpdateCompanyProfileDto) {
    const company = await this.requireCompany(ownerId);
    assertCityCodes([dto.cityCode ?? company.cityCode, ...(dto.serviceCityCodes ?? [])], 'İl');
    if (dto.taxNumber && dto.taxNumber !== company.taxNumber) {
      const taken = await this.prisma.company.findUnique({ where: { taxNumber: dto.taxNumber } });
      if (taken) throw new ConflictException('Bu vergi numarasıyla kayıtlı bir firma var');
    }

    assertNoContactInfo(dto.description, 'Tanıtım yazısı');
    const identityChanged = IDENTITY_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== company[field],
    );
    const { serviceCityCodes, ...fields } = dto;
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      include: WITH_CITIES,
      data: {
        ...fields,
        ...(serviceCityCodes && {
          serviceCities: {
            deleteMany: {},
            create: unique(serviceCityCodes).map((cityCode) => ({ cityCode })),
          },
        }),
        ...(identityChanged && {
          verificationStatus: VerificationStatus.PENDING,
          verifiedAt: null,
          verificationNote: null,
        }),
      },
    });
    if (dto.description !== undefined) await this.refreshShowcaseComplete(company.id);
    return toProfile(updated);
  }

  /**
   * Yorumsuz firma sayfasının arama motoruna açılıp açılmayacağını (showcaseComplete) tanıtım yazısı
   * ve yönetimin gizlemediği fotoğraflardan yeniden hesaplar.
   */
  async refreshShowcaseComplete(companyId: string) {
    const [company, photos] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { description: true, showcaseComplete: true } }),
      this.prisma.companyMedia.count({ where: { companyId, kind: CompanyMediaKind.PHOTO, hiddenAt: null } }),
    ]);
    if (!company) return;
    const complete = isShowcaseComplete(company.description, photos);
    if (complete !== company.showcaseComplete) {
      await this.prisma.company.update({ where: { id: companyId }, data: { showcaseComplete: complete } });
    }
  }

  async requireCompany(ownerId: string): Promise<CompanyWithCities> {
    const company = await this.prisma.company.findUnique({ where: { ownerId }, include: WITH_CITIES });
    if (!company || company.deletedAt) {
      throw new NotFoundException('Önce firma profilinizi oluşturun');
    }
    return company;
  }

  async requireVerifiedCompany(ownerId: string): Promise<CompanyWithCities> {
    const company = await this.requireCompany(ownerId);
    if (company.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Teklif verebilmek için firmanızın doğrulanması gerekiyor');
    }
    // Onaylı K3 belgelerinin hepsinin süresi dolduysa teklif verilemez (belge yüklemeden önce
    // onaylanmış firmaların K3 kaydı yok; onlar yönetimden yeniden incelenene kadar etkilenmez)
    const k3 = await this.prisma.companyDocument.findMany({
      where: { companyId: company.id, type: CompanyDocumentType.K3_LICENSE, status: VerificationStatus.VERIFIED },
      select: { validUntil: true },
    });
    if (k3.length && k3.every((d) => isExpired(d.validUntil))) {
      throw new ForbiddenException('K3 yetki belgenizin süresi dolmuş. Güncel belgeyi Belgeler sayfasından yükleyin.');
    }
    return company;
  }
}

const unique = (codes: string[]) => [...new Set(codes)];

export function toProfile(company: CompanyWithCities) {
  const { deletedAt: _deletedAt, ownerId: _ownerId, serviceCities, ...rest } = company;
  const serviceCityCodes = serviceCities.map((c) => c.cityCode).sort();
  return {
    ...rest,
    cityName: cityName(company.cityCode),
    serviceCityCodes,
    serviceCities: serviceCityCodes.map((code) => ({ code, name: cityName(code) })),
  };
}

/** Müşterilere gösterilen firma özeti: vergi no, belge no gibi alanlar yok */
export function toPublicCompany(company: Company) {
  return {
    id: company.id,
    displayName: company.displayName,
    logoUrl: company.logoUrl,
    cityName: cityName(company.cityCode),
    verified: company.verificationStatus === VerificationStatus.VERIFIED,
    ratingAverage: company.ratingAverage,
    ratingCount: company.ratingCount,
    completedJobs: company.completedJobs,
  };
}
