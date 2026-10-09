import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { BankTransfersService } from '../credits/bank-transfers.service.js';
import { CardPaymentsService } from '../payments/card-payments.service.js';
import { CreditsService } from '../credits/credits.service.js';
import {
  AdjustCreditDto,
  AdminCreditTransactionsDto,
  ApproveBankTransferDto,
  ListCardPaymentsDto,
  ListBankTransfersDto,
  RejectBankTransferDto,
  UpdateCreditSettingsDto,
} from '../credits/dto/credit.dto.js';
import { UserRole } from '../generated/prisma/enums.js';

@ApiTags('Admin: kredi')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminCreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly transfers: BankTransfersService,
    private readonly cardPayments: CardPaymentsService,
  ) {}

  /** Pano: firmalardaki toplam bakiye, bu ay (TSİ) ve tüm zamanlar türe göre toplamlar */
  @Get('credits/overview')
  overview() {
    return this.credits.overview();
  }

  /** Ayarlar; `card` iyzico anahtarlarının sunucuda tanımlı olup olmadığını söyler (anahtarların kendisi dönmez) */
  @Get('credits/settings')
  async settings() {
    return { ...(await this.credits.adminSettings()), card: this.cardPayments.status() };
  }

  /** Önceki ve yeni değerler karar geçmişine yazılır */
  @Patch('credits/settings')
  async updateSettings(@CurrentUser() admin: AuthUser, @Body() dto: UpdateCreditSettingsDto) {
    return { ...(await this.credits.updateSettings(admin.id, { ...dto })), card: this.cardPayments.status() };
  }

  /** Tüm kredi hareketleri; firma, tür ve firma adıyla süzülür */
  @Get('credits/transactions')
  transactions(@Query() { companyId, type, q, page, limit }: AdminCreditTransactionsDto) {
    return this.credits.listTransactions(
      {
        ...(companyId && { companyId }),
        ...(type && { type }),
        ...(q && { company: { displayName: { contains: q } } }),
      },
      page,
      limit,
    );
  }

  @Get('companies/:id/credits')
  async companyCredits(@Param('id') id: string) {
    const [balance, recent] = await Promise.all([this.credits.balance(id), this.credits.listTransactions({ companyId: id }, 1, 10)]);
    return { balance, recent };
  }

  /** Elle ekleme (artı) ya da düşme (eksi); bakiye eksiye düşmez, gerekçe zorunlu */
  @Post('companies/:id/credits')
  adjust(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdjustCreditDto) {
    return this.credits.adjust(admin.id, id, dto.amount, dto.note);
  }

  /** Havale/EFT bildirimleri; bekleyenler en eski önce */
  @Get('credits/transfers')
  listTransfers(@Query() dto: ListBankTransfersDto) {
    return this.transfers.listForAdmin(dto);
  }

  /** Onay: kredi hesaba geçen tutar ÷ kredi değeri kadar yüklenir (aşağı yuvarlanır) */
  @Post('credits/transfers/:id/approve')
  approveTransfer(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ApproveBankTransferDto) {
    return this.transfers.approve(admin.id, id, dto.amountTry);
  }

  @Post('credits/transfers/:id/reject')
  rejectTransfer(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectBankTransferDto) {
    return this.transfers.reject(admin.id, id, dto.reason);
  }

  /** Kart ödemeleri (başarısız ve yarım kalanlar dahil); son 30 günün gerçek tahsilatı */
  @Get('credits/card-payments')
  listCardPayments(@Query() dto: ListCardPaymentsDto) {
    return this.cardPayments.listForAdmin(dto);
  }
}
