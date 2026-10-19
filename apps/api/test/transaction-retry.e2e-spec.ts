import type { ConfigService } from '@nestjs/config';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Aynı anda yazan iki işlem birbirini kilitleyince (deadlock) kaybeden işlem 500 yerine yeniden çalışır.
describe('Veritabanı işlemi çakışınca yeniden denenir (e2e)', () => {
  const prisma = new PrismaService({ getOrThrow: () => process.env.DATABASE_URL } as unknown as ConfigService);
  const phones = ['+905550009101', '+905550009102'];
  let ids: string[];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    ids = [];
    for (const phone of phones) {
      const user = await prisma.user.create({ data: { role: 'CUSTOMER', fullName: 'Kilit Testi', phone, passwordHash: 'x' } });
      ids.push(user.id);
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    await prisma.$disconnect();
  });

  it('ters sırada kilitleyen iki işlem de tamamlanır', async () => {
    let started = 0;
    const bothStarted = async () => {
      started++;
      while (started < 2) await new Promise((resolve) => setTimeout(resolve, 10));
    };
    const runs: number[] = [0, 0];
    const update = (index: number, [first, second]: string[]) =>
      prisma.$transaction(async (tx) => {
        runs[index]++;
        await tx.user.update({ where: { id: first }, data: { fullName: `İşlem ${index}` } });
        if (runs[index] === 1) await bothStarted();
        await tx.user.update({ where: { id: second }, data: { fullName: `İşlem ${index}` } });
      });

    await Promise.all([update(0, ids), update(1, [...ids].reverse())]);
    // Biri kilitlenmede geri alınıp yeniden çalıştı
    expect(runs[0] + runs[1]).toBeGreaterThan(2);
  });

  it('çakışma dışındaki hatalar yeniden denenmez', async () => {
    let runs = 0;
    await expect(
      prisma.$transaction(async () => {
        runs++;
        throw new Error('iş kuralı');
      }),
    ).rejects.toThrow('iş kuralı');
    expect(runs).toBe(1);
  });
});
