import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto.js';
import { SiteSettingsService } from './site-settings.service.js';

/** Sitenin ana sayfaya bastığı arama motoru doğrulama kodları */
@ApiTags('Site ayarları')
@Public()
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  async get() {
    const { verification } = await this.settings.get();
    return { verification };
  }
}

@ApiTags('Admin: site ayarları')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/site-settings')
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  /** Gönderilmeyen kod değişmez, boş gönderilen kaldırılır */
  @Patch()
  update(@CurrentUser() admin: AuthUser, @Body() dto: UpdateSiteSettingsDto) {
    return this.settings.update(admin.id, { ...dto });
  }
}
