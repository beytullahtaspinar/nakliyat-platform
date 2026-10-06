import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CompanyNameChangesService } from '../companies/company-name-changes.service.js';
import { RejectNameChangeDto } from '../companies/dto/company-profile.dto.js';
import { UserRole, VerificationStatus } from '../generated/prisma/enums.js';
import { ListCompaniesDto } from './dto/admin-companies.dto.js';

/** Onaylı firmaların görünen ad değişiklikleri: onaylanana kadar eski ad yayında kalır */
@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/name-changes')
export class AdminNameChangesController {
  constructor(private readonly nameChanges: CompanyNameChangesService) {}

  /** status=PENDING ile onay bekleyenler (en eski önce). q: eski/yeni ad, unvan veya vergi no. */
  @Get()
  list(@Query() dto: ListCompaniesDto) {
    return this.nameChanges.listForAdmin(dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.nameChanges.review(admin.id, id, VerificationStatus.VERIFIED);
  }

  /** Gerekçe firma panelinde gösterilir */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectNameChangeDto) {
    return this.nameChanges.review(admin.id, id, VerificationStatus.REJECTED, dto.reason);
  }
}
