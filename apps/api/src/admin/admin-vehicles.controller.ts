import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompanyVehiclesService } from '../media/company-vehicles.service.js';
import { ListCompaniesDto } from './dto/admin-companies.dto.js';

@ApiTags('Admin: firmalar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/vehicles')
export class AdminVehiclesController {
  constructor(private readonly vehicles: CompanyVehiclesService) {}

  /**
   * Tüm firmaların araçları; status=PENDING ile onay bekleyenler (en eski önce). Ruhsat ve fotoğraflar yan yana
   * incelenir, karar buradan ya da firma inceleme ekranından verilir. q: plaka, firma adı, unvan veya vergi no.
   */
  @Get()
  list(@Query() dto: ListCompaniesDto) {
    return this.vehicles.listForAdmin(dto);
  }
}
