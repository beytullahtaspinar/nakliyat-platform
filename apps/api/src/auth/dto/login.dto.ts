import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'ayse@ornek.com', description: 'Cep telefonu ya da e-posta adresi' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  login?: string;

  @ApiPropertyOptional({
    example: '0532 123 45 67',
    description: 'Eski istemciler için: yalnızca telefon. Yeni istemciler `login` gönderir.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  phone?: string;

  @ApiProperty({ example: 'GucluSifre123' })
  @IsString()
  @MaxLength(72)
  password: string;
}
