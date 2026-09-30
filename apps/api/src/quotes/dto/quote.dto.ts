import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleType } from '../../generated/prisma/enums.js';

export class CreateQuoteDto {
  @ApiProperty({ example: 18500, description: 'KDV dahil toplam fiyat (TL)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(500)
  @Max(1_000_000)
  priceTry: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includesPacking?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includesAssembly?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includesInsurance?: boolean;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(20)
  crewSize: number;

  @ApiProperty({ enum: VehicleType, example: VehicleType.KAMYON })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiPropertyOptional({ example: 'Asansörlü taşıma dahildir.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: 'Teklifin geçerlilik sonu. Verilmezse talep süresi sonuna kadar geçerli.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validUntil?: Date;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

