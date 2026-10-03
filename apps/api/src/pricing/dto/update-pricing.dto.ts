import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PRICING_SETTING_SPECS, type PricingSettingKey, type PricingSettings } from '@nakliyat/pricing';

/** Değiştirilecek katsayılar; gönderilmeyen alan aynı kalır. Alanlar ve sınırlar @nakliyat/pricing'den gelir. */
export class UpdatePricingDto implements Partial<PricingSettings> {}

// Her katsayı için aynı kurallar: isteğe bağlı sayı, paketteki aralıkta
for (const [key, spec] of Object.entries(PRICING_SETTING_SPECS) as [PricingSettingKey, (typeof PRICING_SETTING_SPECS)[PricingSettingKey]][]) {
  const target = UpdatePricingDto.prototype;
  for (const decorate of [
    // Alanlar döngüyle eklendiği için TypeScript tür bilgisi üretmez; Swagger türü açıkça alır
    ApiPropertyOptional({ type: Number, description: `${spec.label} (${spec.unit}): ${spec.hint}`, minimum: spec.min, maximum: spec.max }),
    IsOptional(),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }, { message: `${spec.label} bir sayı olmalı` }),
    Min(spec.min, { message: `${spec.label} en az ${spec.min} olabilir` }),
    Max(spec.max, { message: `${spec.label} en fazla ${spec.max} olabilir` }),
  ]) {
    decorate(target, key);
  }
}
