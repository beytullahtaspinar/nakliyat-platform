import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompaniesService } from '../companies/companies.service.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { BankTransfersService } from './bank-transfers.service.js';
import { CreditsService } from './credits.service.js';
import { CompanyCreditTransactionsDto, CreateBankTransferDto, CreateTransferUploadDto } from './dto/credit.dto.js';

@ApiTags('Firma: kredi')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/credits')
export class CompanyCreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly transfers: BankTransfersService,
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

  /** Havale/EFT bildirimleri, en yenisi önce */
  @Get('transfers')
  async listTransfers(@CurrentUser() user: AuthUser, @Query() { page, limit }: PaginationDto) {
    const company = await this.companies.requireCompany(user.id);
    return this.transfers.listOwn(company.id, page, limit);
  }

  /** Dekont için kısa süreli yükleme adresi (PDF/JPG/PNG/WebP, en fazla 10 MB) */
  @Post('transfers/uploads')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferUploadDto) {
    return this.transfers.createReceiptUpload(user.id, dto);
  }

  /** "Havale yaptım" bildirimi; yönetim onaylayınca kredi yüklenir */
  @Post('transfers')
  async createTransfer(@CurrentUser() user: AuthUser, @Body() dto: CreateBankTransferDto) {
    const company = await this.companies.requireCompany(user.id);
    return this.transfers.create(company.id, user.id, dto);
  }

  /** Onay bekleyen bildirimi geri alır */
  @Post('transfers/:id/cancel')
  async cancelTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const company = await this.companies.requireCompany(user.id);
    return this.transfers.cancel(company.id, user.id, id);
  }
}
