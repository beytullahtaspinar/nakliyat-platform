import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getCities, getCityByCode } from '@nakliyat/locations';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('İl ve ilçeler')
@Public()
@Controller('locations')
export class LocationsController {
  @Get('cities')
  cities() {
    return getCities().map(({ code, name, slug }) => ({ code, name, slug }));
  }

  @Get('cities/:code/districts')
  districts(@Param('code') code: string) {
    const city = getCityByCode(code);
    if (!city) throw new NotFoundException('İl bulunamadı');
    return city.districts;
  }
}
