// İlk admin hesabını oluşturur veya şifresini yeniler. Admin dışarıdan kayıtla açılamaz.
//   ADMIN_PHONE=05xx... ADMIN_PASSWORD=... ADMIN_NAME="Ad Soyad" node dist/create-admin.js
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { normalizeTrMobile } from './common/utils/phone.js';
import { PrismaClient } from './generated/prisma/client.js';
import { UserRole } from './generated/prisma/enums.js';

const phone = normalizeTrMobile(process.env.ADMIN_PHONE ?? '');
const password = process.env.ADMIN_PASSWORD ?? '';
const fullName = process.env.ADMIN_NAME ?? 'Yönetici';
if (!phone || password.length < 12) {
  console.error('ADMIN_PHONE (geçerli cep no) ve en az 12 karakterli ADMIN_PASSWORD gerekli.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { phone },
  create: { phone, fullName, passwordHash, role: UserRole.ADMIN, phoneVerifiedAt: new Date() },
  update: { passwordHash, role: UserRole.ADMIN },
});
await prisma.$disconnect();
console.log(`Admin hazır: ${user.fullName} (${user.phone})`);
