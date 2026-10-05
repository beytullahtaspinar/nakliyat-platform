import { BadRequestException, ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../auth/auth.service.js';
import { normalizeTrMobile } from '../common/utils/phone.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { UserRole } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCreateUserDto } from './dto/admin-lists.dto.js';

/**
 * Yönetimden açılan hesabın kaydı: telefon ve e-posta başka hesapta olmamalı.
 * Kullanım koşulları onayı boş kalır (kişi kendisi kabul etmedi); doğrulama yalnızca yönetici işaretlerse sayılır.
 */
export async function newAccountData(
  prisma: PrismaService,
  dto: AdminCreateUserDto,
  role: UserRole,
): Promise<Prisma.UserCreateWithoutCompanyInput> {
  const phone = normalizeTrMobile(dto.phone);
  if (!phone) throw new BadRequestException('Geçerli bir cep telefonu numarası girin');
  const email = dto.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, { email }] }, select: { phone: true } });
  if (existing) {
    throw new ConflictException(
      existing.phone === phone
        ? 'Bu telefon numarasıyla kayıtlı bir hesap var'
        : 'Bu e-posta adresiyle kayıtlı bir hesap var',
    );
  }
  const now = new Date();
  return {
    role,
    fullName: dto.fullName,
    phone,
    email,
    passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    ...(dto.markVerified && { phoneVerifiedAt: now, emailVerifiedAt: now }),
  };
}
