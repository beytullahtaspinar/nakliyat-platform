import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, Matches, MaxLength } from 'class-validator';

export class SendEmailCodeDto {
  @ApiPropertyOptional({
    example: 'ayse@ornek.com',
    description: 'Yeni adres. Verilmezse hesaptaki adrese gönderilir. Adres, kod onaylanınca hesaba yazılır.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi gir' })
  @MaxLength(191)
  email?: string;
}

export class ConfirmCodeDto {
  @ApiProperty({ example: '513001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @Matches(/^\d{6}$/, { message: 'Kod 6 haneli olmalı' })
  code: string;
}

export class VerificationStatusDto {
  @ApiPropertyOptional({ type: String, nullable: true }) email: string | null;
  @ApiProperty() emailVerified: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Geçerli kodun gönderildiği e-posta' })
  emailCodeSentTo: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Yeni kod bu andan sonra istenebilir' })
  emailResendAt: string | null;

  @ApiProperty() phone: string;
  @ApiProperty() phoneVerified: boolean;
  @ApiProperty({ description: 'Telefon sağlayıcısı (SMS/WhatsApp) yapılandırıldıysa telefon doğrulaması zorunludur' })
  phoneRequired: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'sms veya whatsapp' })
  phoneChannel: 'sms' | 'whatsapp' | null;
  @ApiProperty() phoneCodeSent: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) phoneResendAt: string | null;

  @ApiProperty({ description: 'Talep yayını, teklif verme ve teklif kabulü için gereken doğrulamalar tamam' })
  complete: boolean;
}
