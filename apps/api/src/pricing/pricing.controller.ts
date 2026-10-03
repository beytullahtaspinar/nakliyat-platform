import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PricingService } from './pricing.service.js';

@ApiTags('Fiyat hesaplayıcı')
@Public()
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /**
   * Herkese açık fiyat hesaplayıcının katsayıları ve platform verisiyle ayarlaması.
   * Fiyatın kendisi tarayıcıda @nakliyat/pricing ile hesaplanır.
   */
  @Get()
  model() {
    return this.pricing.publicModel();
  }
}
