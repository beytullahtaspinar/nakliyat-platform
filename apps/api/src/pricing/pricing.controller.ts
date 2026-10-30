import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { getCityByCode } from '@nakliyat/locations';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PricingService } from './pricing.service.js';
import { RegionStatsService } from './region-stats.service.js';

@ApiTags('Fiyat hesaplayıcı')
@Public()
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly regionStats: RegionStatsService,
  ) {}

  /**
   * Herkese açık fiyat hesaplayıcının katsayıları ve platform verisiyle ayarlaması.
   * Fiyatın kendisi tarayıcıda @nakliyat/pricing ile hesaplanır.
   */
  @Get()
  model() {
    return this.pricing.publicModel();
  }

  /**
   * Bölge sayfası için gerçek teklif verisi: il içi (from = to) ya da iki il arası, son 90 gün.
   * Eşiği geçmeyen ev tipleri listelenmez.
   */
  @Get('regions/:from/:to')
  region(@Param('from') from: string, @Param('to') to: string) {
    if (!getCityByCode(from) || !getCityByCode(to)) throw new NotFoundException('İl bulunamadı');
    return this.regionStats.get(from, to);
  }
}
