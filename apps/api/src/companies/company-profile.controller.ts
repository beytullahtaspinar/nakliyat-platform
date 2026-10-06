import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompaniesService } from './companies.service.js';
import { CompanyBadgesService } from './company-badges.service.js';
import { CreateCompanyProfileDto, UpdateCompanyProfileDto } from './dto/company-profile.dto.js';

@ApiTags('Firma: profil')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/profile')
export class CompanyProfileController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly badges: CompanyBadgesService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyProfileDto) {
    return this.companies.create(user.id, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.companies.getOwn(user.id);
  }

  /** Rozetler: hangileri kazanıldı, diğerleri için ne eksik */
  @Get('badges')
  async badgeProgress(@CurrentUser() user: AuthUser) {
    return this.badges.progress(await this.companies.requireCompany(user.id));
  }

  /**
   * Vergi no veya K3 belge no değişirse firma yeniden doğrulamaya düşer. Onaylı firmanın görünen ad
   * değişikliği yönetim onayına gider (yılda en fazla 2). Unvan ve telefon buradan değiştirilemez
   * (bkz. UpdateCompanyProfileDto).
   */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyProfileDto) {
    return this.companies.update(user.id, dto);
  }
}
