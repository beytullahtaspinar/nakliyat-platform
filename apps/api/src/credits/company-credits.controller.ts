import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService } from '../companies/companies.service.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CreditsService } from './credits.service.js';
import { CompanyCreditTransactionsDto } from './dto/credit.dto.js';

@ApiTags('Firma: kredi')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/credits')
export class CompanyCreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly companies: CompaniesService,
  ) {}

  /** Bakiye, teklif başına kredi ve sistemin açık olup olmadığı */
  @Get()
  async summary(@CurrentUser() user: AuthUser) {
    const company = await this.companies.requireCompany(user.id);
    return this.credits.summary(company.id);
  }

  /** Firmanın kredi hareketleri, en yenisi önce */
  @Get('transactions')
  async transactions(@CurrentUser() user: AuthUser, @Query() { type, page, limit }: CompanyCreditTransactionsDto) {
    const company = await this.companies.requireCompany(user.id);
    return this.credits.listTransactions({ companyId: company.id, ...(type && { type }) }, page, limit);
  }
}
