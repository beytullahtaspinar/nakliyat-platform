import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HomeType } from '../../generated/prisma/enums.js';

export class CreateRequestDto {
  @ApiProperty({ example: '34', description: 'Çıkış ili plaka kodu' })
  @Matches(/^\d{2}$/)
  fromCityCode: string;

  @ApiProperty({ example: 'kadikoy', description: 'Çıkış ilçesi adres kodu (GET /locations/cities/:code/districts)' })
  @IsString()
  fromDistrict: string;

  @ApiProperty({ example: 'Caferağa Mah. Moda Cad. No:1 D:5' })
  @IsString()
  @Length(5, 300)
  fromAddress: string;

  @ApiProperty({ example: 3, description: 'Kat (bodrum için -1)' })
  @IsInt()
  @Min(-3)
  @Max(60)
  fromFloor: number;

  @ApiProperty()
  @IsBoolean()
  fromHasElevator: boolean;

  @ApiProperty({ example: '06' })
  @Matches(/^\d{2}$/)
  toCityCode: string;

  @ApiProperty({ example: 'cankaya' })
  @IsString()
  toDistrict: string;

  @ApiProperty({ example: 'Kızılay Mah. Atatürk Blv. No:10 D:2' })
  @IsString()
  @Length(5, 300)
  toAddress: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(-3)
  @Max(60)
  toFloor: number;

  @ApiProperty()
  @IsBoolean()
  toHasElevator: boolean;

  @ApiProperty({ enum: HomeType, example: HomeType.TWO_PLUS_ONE })
  @IsEnum(HomeType)
  homeType: HomeType;

  @ApiProperty({ example: '2026-11-15', description: 'Taşınma tarihi (en erken yarın, en geç 1 yıl sonra)' })
  @Type(() => Date)
  @IsDate()
  moveDate: Date;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDateFlexible?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  needsPacking?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  needsAssembly?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  needsStorage?: boolean;

  @ApiPropertyOptional({ example: ['Piyano', 'Antika vitrin'], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specialItems?: string[];

  @ApiPropertyOptional({ example: 'Sokak dar, kamyon girmiyor.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
