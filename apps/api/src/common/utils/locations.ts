import { BadRequestException } from '@nestjs/common';
import { getCityByCode } from '@nakliyat/locations';

export function assertCityCodes(codes: string[], field: string) {
  const invalid = codes.filter((c) => !getCityByCode(c));
  if (invalid.length) {
    throw new BadRequestException(`${field} içinde geçersiz il kodu: ${invalid.join(', ')}`);
  }
}

export const cityName = (code: string) => getCityByCode(code)?.name ?? null;
