import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AdminListReviewsDto, HideReviewDto } from '../reviews/dto/review.dto.js';
import { ReviewsService } from '../reviews/reviews.service.js';

@ApiTags('Admin: değerlendirmeler')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Tüm değerlendirmeler, en yeni önce; yayında/gizli, puan ve firma adı/metin araması */
  @Get()
  list(@Query() dto: AdminListReviewsDto) {
    return this.reviews.adminList(dto);
  }

  /** Yorumu gerekçeyle gizler: herkese açık sayfadan ve puan ortalamasından çıkar */
  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  hide(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: HideReviewDto) {
    return this.reviews.hide(admin.id, id, dto.reason);
  }

  /** Gizlenen yorumu yeniden yayına alır */
  @Post(':id/show')
  @HttpCode(HttpStatus.OK)
  show(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.reviews.show(admin.id, id);
  }
}
