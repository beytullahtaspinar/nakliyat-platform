import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompanyShowcaseService } from './company-showcase.service.js';
import {
  AttachShowcaseMediaDto,
  CreateShowcaseUploadDto,
  UpdateShowcaseDto,
  UpdateShowcaseMediaDto,
} from './dto/company-showcase.dto.js';

/** Firmanın herkese açık tanıtım sayfası (/firmalar/<ad>-<kimlik>): yazı, hizmetler, logo, fotoğraflar */
@ApiTags('Firma: tanıtım sayfası')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/showcase')
export class CompanyShowcaseController {
  constructor(private readonly showcase: CompanyShowcaseService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.showcase.getOwn(user.id);
  }

  /** Yönetici onayı beklemeden yayınlanır. Telefon, e-posta, web adresi yazılamaz. */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateShowcaseDto) {
    return this.showcase.update(user.id, dto);
  }

  /** Logo ya da fotoğraf (büyük + önizleme) için kısa süreli yükleme adresleri */
  @Post('uploads')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateShowcaseUploadDto) {
    return this.showcase.createUpload(user.id, dto);
  }

  /** Yüklenen görseli sayfaya ekler; yeni logo eskisinin yerini alır */
  @Post('media')
  @HttpCode(HttpStatus.OK)
  attach(@CurrentUser() user: AuthUser, @Body() dto: AttachShowcaseMediaDto) {
    return this.showcase.attach(user.id, dto);
  }

  @Patch('media/:mediaId')
  updateMedia(@CurrentUser() user: AuthUser, @Param('mediaId') mediaId: string, @Body() dto: UpdateShowcaseMediaDto) {
    return this.showcase.updateCaption(user.id, mediaId, dto.caption);
  }

  @Delete('media/:mediaId')
  remove(@CurrentUser() user: AuthUser, @Param('mediaId') mediaId: string) {
    return this.showcase.remove(user.id, mediaId);
  }
}
