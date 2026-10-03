import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { UpdatePricingDto } from '../pricing/dto/update-pricing.dto.js';
import { PricingService } from '../pricing/pricing.service.js';

@ApiTags('Admin: fiyat hesaplayıcı')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/pricing')
export class AdminPricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Katsayılar, varsayılanlar, dönemdeki anlaşma sayıları ve platform verisiyle ayarlama */
  @Get()
  view() {
    return this.pricing.adminView();
  }

  /** Katsayıları değiştirir; önceki ve yeni değerler karar geçmişine yazılır */
  @Patch()
  update(@CurrentUser() admin: AuthUser, @Body() dto: UpdatePricingDto) {
    return this.pricing.update(admin.id, { ...dto });
  }
}
