import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompanyDocumentsService } from '../media/company-documents.service.js';
import { ListCompaniesDto } from './dto/admin-companies.dto.js';

@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(private readonly documents: CompanyDocumentsService) {}

  /**
   * Tüm firmaların belgeleri; status=PENDING ile onay bekleyenler (en eski önce). Onaylı firmanın yeni
   * yüklediği ya da güncellediği belgeler de burada; karar firma inceleme ekranından verilir.
   * q: firma adı, unvan veya vergi no.
   */
  @Get()
  list(@Query() dto: ListCompaniesDto) {
    return this.documents.listForAdmin(dto);
  }
}
