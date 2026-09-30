import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '0532 123 45 67' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'GucluSifre123' })
  @IsString()
  @MaxLength(72)
  password: string;
}
