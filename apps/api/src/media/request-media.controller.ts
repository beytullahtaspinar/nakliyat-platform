import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AttachMediaDto, CreateUploadsDto } from './dto/media.dto.js';
import { MediaService } from './media.service.js';

@ApiTags('Taşıma talepleri (müşteri)')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('requests/:id/media')
export class RequestMediaController {
  constructor(private readonly media: MediaService) {}

  /** Küçültülmüş dosyalar için kısa süreli yükleme adresleri (30 dk) */
  @Post('uploads')
  createUploads(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateUploadsDto) {
    return this.media.createUploads(user.id, id, dto);
  }

  /** Yüklenen dosyaları talebe bağlar; talebin güncel dosya listesini döner */
  @Post()
  @HttpCode(HttpStatus.OK)
  attach(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AttachMediaDto) {
    return this.media.attach(user.id, id, dto);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.media.remove(user.id, id, mediaId);
  }
}
