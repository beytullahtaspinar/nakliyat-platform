import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Company } from '../generated/prisma/client.js';
import { VerificationStatus } from '../generated/prisma/enums.js';
import { assertCityCodes, cityName } from '../common/utils/locations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateCompanyProfileDto,
  UpdateCompanyProfileDto,
} from './dto/company-profile.dto.js';

/** Değişirse firmanın yeniden doğrulanması gereken alanlar */
const IDENTITY_FIELDS = ['legalName', 'taxNumber', 'k3LicenseNumber'] as const;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateCompanyProfileDto) {
    assertCityCodes([dto.cityCode, ...dto.serviceCityCodes], 'İl');
    if (await this.prisma.company.findUnique({ where: { ownerId } })) {
      throw new ConflictException('Bu hesaba ait bir firma profili zaten var');
    }
    if (await this.prisma.company.findUnique({ where: { taxNumber: dto.taxNumber } })) {
      throw new ConflictException('Bu vergi numarasıyla kayıtlı bir firma var');
    }
    const company = await this.prisma.company.create({
      data: { ...dto, ownerId, serviceCityCodes: unique(dto.serviceCityCodes) },
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

    const identityChanged = IDENTITY_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== company[field],
    );
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        ...dto,
        ...(dto.serviceCityCodes && { serviceCityCodes: unique(dto.serviceCityCodes) }),
        ...(identityChanged && {
          verificationStatus: VerificationStatus.PENDING,
          verifiedAt: null,
          verificationNote: null,
        }),
      },
    });
    return toProfile(updated);
  }

  async requireCompany(ownerId: string): Promise<Company> {
    const company = await this.prisma.company.findUnique({ where: { ownerId } });
    if (!company || company.deletedAt) {
      throw new NotFoundException('Önce firma profilinizi oluşturun');
    }
    return company;
  }

  async requireVerifiedCompany(ownerId: string): Promise<Company> {
    const company = await this.requireCompany(ownerId);
    if (company.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Teklif verebilmek için firmanızın doğrulanması gerekiyor');
    }
    return company;
  }
}

const unique = (codes: string[]) => [...new Set(codes)];

export function toProfile(company: Company) {
  const { deletedAt: _deletedAt, ownerId: _ownerId, ...rest } = company;
  return {
    ...rest,
    cityName: cityName(company.cityCode),
    serviceCities: company.serviceCityCodes.map((code) => ({ code, name: cityName(code) })),
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
