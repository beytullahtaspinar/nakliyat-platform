import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompanyDocumentsService } from './company-documents.service.js';
import { AttachDocumentDto, CreateDocumentUploadDto } from './dto/company-documents.dto.js';

@ApiTags('Firma: belgeler')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/documents')
export class CompanyDocumentsController {
  constructor(private readonly documents: CompanyDocumentsService) {}

  /** Yüklenen belgeler ve zorunlu belgelerin durumu (K3, vergi levhası, ticaret sicil) */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.documents.listOwn(user.id);
  }

  /** Belge için kısa süreli yükleme adresi (30 dk). PDF, JPG, PNG ya da WebP; en fazla 10 MB. */
  @Post('uploads')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentUploadDto) {
    return this.documents.createUpload(user.id, dto);
  }

  /** Yüklenen dosyayı belge olarak kaydeder; aynı türün onaylanmamış eski belgesinin yerini alır */
  @Post()
  @HttpCode(HttpStatus.OK)
  attach(@CurrentUser() user: AuthUser, @Body() dto: AttachDocumentDto) {
    return this.documents.attach(user.id, dto);
  }

  /** Onaylanmamış belgeyi siler */
  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('documentId') documentId: string) {
    return this.documents.remove(user.id, documentId);
  }
}
