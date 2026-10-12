import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Şifresi olan hesaplarda zorunlu; yalnızca Google/Apple ile açılan hesaplarda gönderilmez' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;
}
