import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto.js';
import { QuotesService } from './quotes.service.js';

@ApiTags('Firma: talepler ve teklifler')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company')
export class CompanyQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get('requests')
  listRequests(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.quotes.listOpenRequestsForCompany(user.id, query);
  }

  @Get('requests/:id')
  getRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotes.getRequestForCompany(user.id, id);
  }

  @Post('requests/:id/quotes')
  createQuote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.createQuote(user.id, id, dto);
  }

  @Get('quotes')
  listQuotes(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.quotes.listCompanyQuotes(user.id, query);
  }

  @Patch('quotes/:id')
  updateQuote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.updateQuote(user.id, id, dto);
  }

  @Post('quotes/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotes.withdrawQuote(user.id, id);
  }
}
