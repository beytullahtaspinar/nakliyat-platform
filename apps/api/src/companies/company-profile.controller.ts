import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyProfileDto, UpdateCompanyProfileDto } from './dto/company-profile.dto.js';

@ApiTags('Firma: profil')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/profile')
export class CompanyProfileController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyProfileDto) {
    return this.companies.create(user.id, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.companies.getOwn(user.id);
  }

  /** Unvan, vergi no veya K3 belge no değişirse firma yeniden doğrulamaya düşer. */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyProfileDto) {
    return this.companies.update(user.id, dto);
  }
}
