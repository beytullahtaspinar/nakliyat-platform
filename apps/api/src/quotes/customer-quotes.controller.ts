import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { QuotesService } from './quotes.service.js';

@ApiTags('Taşıma talepleri (müşteri)')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller()
export class CustomerQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /** Gelen teklifler, fiyata göre artan sırada; firma puanı ve doğrulama bilgisiyle */
  @Get('requests/:id/quotes')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotes.listQuotesForCustomer(user.id, id);
  }

  /** Teklifi kabul et: iş oluşur, firmanın iletişim bilgisi açılır, diğer teklifler reddedilir */
  @Post('quotes/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotes.acceptQuote(user.id, id);
  }
}
