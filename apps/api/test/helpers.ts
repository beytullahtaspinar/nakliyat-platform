import { randomBytes } from 'node:crypto';
import type { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Doğrulama akışını konu almayan testler için: kullanıcıları e-postası doğrulanmış sayar.
 * Kod akışının kendisi verification.e2e-spec.ts'te test edilir.
 */
export async function markVerified(prisma: PrismaService, phones: string[]) {
  await prisma.user.updateMany({ where: { phone: { in: phones } }, data: { emailVerifiedAt: new Date() } });
}

/**
 * Belge akışını konu almayan testler için: firmaya onaylı zorunlu belgeleri (K3, vergi levhası, ticaret sicil)
 * doğrudan veritabanına ekler, böylece yönetici firmayı onaylayabilir. Belge akışı company-documents.e2e-spec.ts'te.
 */
export async function addApprovedDocuments(prisma: PrismaService, companyIds: string[]) {
  const nextYear = new Date(Date.now() + 365 * 86_400_000);
  await prisma.companyDocument.createMany({
    data: companyIds.flatMap((companyId) =>
      (['K3_LICENSE', 'TAX_CERTIFICATE', 'TRADE_REGISTRY'] as const).map((type) => ({
        companyId,
        type,
        storageKey: `firmalar/${companyId}/${randomBytes(16).toString('hex')}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        fileName: `${type}.pdf`,
        validUntil: type === 'K3_LICENSE' ? nextYear : null,
        status: 'VERIFIED' as const,
      })),
    ),
  });
}

/**
 * Test dosyaları paralel koştuğu için temizlikteki ilişkili deleteMany'ler başka dosyanın yazmasıyla
 * kilitlenebilir (MariaDB deadlock, Prisma P2034). Temizliği birkaç kez dener.
 */
export async function retryOnConflict(fn: () => Promise<void>, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2034' || i >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 100 * i));
    }
  }
}
