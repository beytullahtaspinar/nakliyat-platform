import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CompanyVehiclesService } from './company-vehicles.service.js';
import { CreateVehicleDto, CreateVehicleUploadDto, UpdateVehicleDto } from './dto/company-vehicles.dto.js';

@ApiTags('Firma: araçlar')
@ApiBearerAuth()
@Roles(UserRole.COMPANY)
@Controller('company/vehicles')
export class CompanyVehiclesController {
  constructor(private readonly vehicles: CompanyVehiclesService) {}

  /** Araçlar ve onaylı araç sayısı. Firma onayı için en az bir onaylı araç gerekir. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.vehicles.listOwn(user.id);
  }

  /** Ruhsat ya da fotoğraf için kısa süreli yükleme adresi (30 dk) */
  @Post('uploads')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleUploadDto) {
    return this.vehicles.createUpload(user.id, dto);
  }

  /** Aracı ruhsat ve önden, yandan, arkadan fotoğrafla kaydeder; yönetici inceler */
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(user.id, dto);
  }

  /** Onaylanmamış aracı düzeltir (yalnızca değişen alanlar ve dosyalar); araç yeniden incelemeye girer */
  @Patch(':vehicleId')
  update(@CurrentUser() user: AuthUser, @Param('vehicleId') vehicleId: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(user.id, vehicleId, dto);
  }

  @Delete(':vehicleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('vehicleId') vehicleId: string) {
    return this.vehicles.remove(user.id, vehicleId);
  }
}
