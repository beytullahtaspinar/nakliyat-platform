import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreditsService } from '../credits/credits.service.js';
import { AdjustCreditDto, AdminCreditTransactionsDto, UpdateCreditSettingsDto } from '../credits/dto/credit.dto.js';
import { UserRole } from '../generated/prisma/enums.js';

@ApiTags('Admin: kredi')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminCreditsController {
  constructor(private readonly credits: CreditsService) {}

  /** Pano: firmalardaki toplam bakiye, bu ay (TSİ) ve tüm zamanlar türe göre toplamlar */
  @Get('credits/overview')
  overview() {
    return this.credits.overview();
  }

  @Get('credits/settings')
  settings() {
    return this.credits.adminSettings();
  }

  /** Önceki ve yeni değerler karar geçmişine yazılır */
  @Patch('credits/settings')
  updateSettings(@CurrentUser() admin: AuthUser, @Body() dto: UpdateCreditSettingsDto) {
    return this.credits.updateSettings(admin.id, { ...dto });
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
}
