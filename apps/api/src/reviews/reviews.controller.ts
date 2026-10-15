import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CancelBookingDto, CreateReviewDto, DisputeBookingDto, ListReviewsDto, ReplyReviewDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Değerlendirmeler')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Müşteri ya da firma işi tamamlandı olarak işaretler (taşınma günü geldikten sonra). */
  @Roles(UserRole.CUSTOMER, UserRole.COMPANY)
  @Post('bookings/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviews.completeBooking(user, id);
  }

  /** Müşteri ya da firma anlaşılan işi gerekçeyle iptal eder (taşınma gününün sonuna kadar). */
  @Roles(UserRole.CUSTOMER, UserRole.COMPANY)
  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.reviews.cancelBooking(user, id, dto.reason);
  }

  /**
   * Müşteri ya da firma "taşınma yapılmadı" der (taşınma günü geldikten sonra, iş tamamlanmadan).
   * İş kendiliğinden tamamlanmaz; yönetici inceleyip tamamlar ya da iptal eder.
   */
  @Roles(UserRole.CUSTOMER, UserRole.COMPANY)
  @Post('bookings/:id/dispute')
  @HttpCode(HttpStatus.OK)
  dispute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DisputeBookingDto) {
    return this.reviews.disputeBooking(user, id, dto.reason);
  }

  /** Müşteri tamamlanan işin firmasını 1-5 puanla, isteğe bağlı yorumla değerlendirir (iş başına bir kez). */
  @Roles(UserRole.CUSTOMER)
  @Post('bookings/:id/review')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateReviewDto) {
    // Yorum herkese açık ve müşterinin kendi görüşü; yönetici müşteri adına yazamaz
    if (user.impersonatorId) throw new ForbiddenException('Değerlendirmeyi müşterinin kendisi yazmalı');
    return this.reviews.create(user.id, id, dto);
  }

  /** Müşteri puanını ve yorumunu düzenler (yorumda "düzenlendi" görünür, firmaya bildirilir) */
  @Roles(UserRole.CUSTOMER)
  @Patch('bookings/:id/review')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateReviewDto) {
    if (user.impersonatorId) throw new ForbiddenException('Değerlendirmeyi müşterinin kendisi düzenlemeli');
    return this.reviews.update(user.id, id, dto);
  }

  /** Firmanın aldığı değerlendirmeler (gizlenenler dahil), süzgeç ve sıralamayla; puan özeti ve sayaçlar */
  @Roles(UserRole.COMPANY)
  @Get('company/reviews')
  listOwn(@CurrentUser() user: AuthUser, @Query() dto: ListReviewsDto) {
    return this.reviews.listForCompany(user.id, dto);
  }

  /** Firma yoruma bir kez yanıt verir (müşteri yorumu sonradan düzenlediyse yanıtını güncelleyebilir) */
  @Roles(UserRole.COMPANY)
  @Post('company/reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return this.reviews.reply(user.id, id, dto.body);
  }
}
