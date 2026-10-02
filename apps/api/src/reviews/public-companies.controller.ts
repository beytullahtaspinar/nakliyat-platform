import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';
import { PublicCompaniesDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

/** Herkese açık firma sayfaları: yalnızca doğrulanmış ve etkin firmalar */
@ApiTags('Firmalar (herkese açık)')
@Public()
@Controller('companies')
export class PublicCompaniesController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Doğrulanmış firmalar, en çok yorum alan önce (site haritası ve listeler için) */
  @Get()
  list(@Query() dto: PublicCompaniesDto) {
    return this.reviews.listPublicCompanies(dto);
  }

  /** Firma profili ve puan dağılımı */
  @Get(':id')
  profile(@Param('id') id: string) {
    return this.reviews.publicProfile(id);
  }

  /** Yayındaki yorumlar, en yeni önce. Müşteri adı kısaltılır ("Ayşe Y."). */
  @Get(':id/reviews')
  reviewsOf(@Param('id') id: string, @Query() { page, limit }: PaginationDto) {
    return this.reviews.publicReviews(id, page, limit);
  }
}
