import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { SaveLocalPageDto } from './dto/local-page.dto.js';
import { LocalPagesService } from './local-pages.service.js';

/** Bölge sayfalarının yönetimden yazılan içeriği (il, ilçe, güzergâh ve merkez sayfa) */
@ApiTags('Bölge sayfaları')
@Public()
@Controller('local-pages')
export class LocalPagesController {
  constructor(private readonly pages: LocalPagesService) {}

  /** Düzenlenmiş tüm sayfalar; listede olmayan sayfa tamamen otomatik metinle çizilir */
  @Get()
  list() {
    return this.pages.listPublic();
  }
}

@ApiTags('Admin: bölge sayfaları')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/local-pages')
export class AdminLocalPagesController {
  constructor(private readonly pages: LocalPagesService) {}

  @Get()
  list() {
    return this.pages.adminList();
  }

  /** Sayfa hiç düzenlenmediyse null */
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.pages.adminGet(slug);
  }

  /** Tüm alanlar boşsa sayfa varsayılana döner */
  @Patch(':slug')
  save(@CurrentUser() admin: AuthUser, @Param('slug') slug: string, @Body() dto: SaveLocalPageDto) {
    return this.pages.save(admin.id, slug, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  reset(@CurrentUser() admin: AuthUser, @Param('slug') slug: string) {
    return this.pages.reset(admin.id, slug);
  }
}
