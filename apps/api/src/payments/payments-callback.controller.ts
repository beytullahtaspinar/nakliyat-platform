import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { CardPaymentsService } from './card-payments.service.js';

/**
 * iyzico ödeme sayfasının dönüşü. Firmanın tarayıcısı buraya token ile POST eder; sonuç iyzico'ya
 * sunucudan sorulur (gelen isteğe güvenilmez), sonra firma kredi sayfasına yönlendirilir.
 */
@ApiExcludeController()
@Public()
@Controller('payments/iyzico')
export class PaymentsCallbackController {
  constructor(private readonly payments: CardPaymentsService) {}

  @Post('callback')
  @HttpCode(303)
  async callback(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const token = typeof body?.token === 'string' ? body.token.slice(0, 191) : '';
    const payment = token ? await this.payments.complete(token) : null;
    const query = payment ? `odeme=${encodeURIComponent(payment.id)}` : 'odeme=bilinmiyor';
    res.redirect(303, `${this.payments.webUrl}/firma-paneli/kredi?${query}#kart`);
  }
}
