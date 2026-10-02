import type { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Doğrulama akışını konu almayan testler için: kullanıcıları e-postası doğrulanmış sayar.
 * Kod akışının kendisi verification.e2e-spec.ts'te test edilir.
 */
export async function markVerified(prisma: PrismaService, phones: string[]) {
  await prisma.user.updateMany({ where: { phone: { in: phones } }, data: { emailVerifiedAt: new Date() } });
}
