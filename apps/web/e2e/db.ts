import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * API'nin derlenmiş Prisma istemcisiyle veritabanında küçük bir hazırlık yapar (testte bekleyemeyeceğimiz
 * durumlar için, ör. taşınma gününün gelmesi). `pnpm build` sonrası dist/ hazır olmalı.
 */
function runWithPrisma(body: string, env: Record<string, string>) {
  const script = `
    import 'dotenv/config';
    import { PrismaClient } from './dist/generated/prisma/client.js';
    import { createMariaDbAdapter } from './dist/prisma/connection.js';
    const prisma = new PrismaClient({ adapter: createMariaDbAdapter(process.env.DATABASE_URL) });
    try { ${body} } finally { await prisma.$disconnect(); }
  `;
  execFileSync("node", ["--input-type=module", "-e", script], {
    cwd: path.resolve(__dirname, "../../api"),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
}

/** İşin taşınma gününü bugüne çeker: iş tamamlandı olarak işaretlenebilir olur */
export function moveDayIsToday(bookingId: string) {
  runWithPrisma(
    `const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
     await prisma.booking.update({ where: { id: process.env.BOOKING_ID }, data: { scheduledAt: new Date(today) } });`,
    { BOOKING_ID: bookingId },
  );
}

/** İşin taşınma gününü `days` gün öncesine çeker (taşınma sonrası takip ve itiraz akışları için) */
export function moveDayWasDaysAgo(bookingId: string, days: number) {
  runWithPrisma(
    `const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
     const day = new Date(Date.parse(today) - Number(process.env.DAYS) * 86400000);
     await prisma.booking.update({ where: { id: process.env.BOOKING_ID }, data: { scheduledAt: day } });`,
    { BOOKING_ID: bookingId, DAYS: String(days) },
  );
}

/**
 * Bölge teklif istatistiği için iki doğrulanmış firmadan `prices.length` teklif yazar (from → to, 2+1).
 * Telefon numaraları `phonePrefix` + 2 hane; aynı önekle yeniden çağrılırsa önce eski kayıtları siler.
 */
export function seedRegionQuotes(fromCityCode: string, toCityCode: string, prices: number[], phonePrefix: string) {
  runWithPrisma(
    `const { FROM, TO, PREFIX } = process.env;
     const prices = JSON.parse(process.env.PRICES);
     const users = { phone: { startsWith: PREFIX } };
     await prisma.quote.deleteMany({ where: { company: { owner: users } } });
     await prisma.movingRequest.deleteMany({ where: { customer: users } });
     await prisma.company.deleteMany({ where: { owner: users } });
     await prisma.user.deleteMany({ where: users });
     const user = (n, role) => prisma.user.create({ data: { role, fullName: 'İstatistik ' + n, phone: PREFIX + n, passwordHash: 'x' } });
     const customer = await user('00', 'CUSTOMER');
     const companies = [];
     for (const n of ['01', '02']) {
       const owner = await user(n, 'COMPANY');
       companies.push(await prisma.company.create({ data: {
         ownerId: owner.id, legalName: 'İstatistik ' + n + ' Ltd.', displayName: 'İstatistik ' + n,
         taxNumber: PREFIX.slice(-8) + n, cityCode: FROM, verificationStatus: 'VERIFIED',
       } }));
     }
     const later = new Date(Date.now() + 7 * 86400000);
     for (const [i, priceTry] of prices.entries()) {
       const r = await prisma.movingRequest.create({ data: {
         customerId: customer.id, status: 'OPEN', fromCityCode: FROM, fromDistrict: 'merkez', fromAddress: 'Test',
         fromFloor: 1, fromHasElevator: false, toCityCode: TO, toDistrict: 'merkez', toAddress: 'Test', toFloor: 1,
         toHasElevator: false, homeType: 'TWO_PLUS_ONE', moveDate: later, specialItems: [], expiresAt: later,
       } });
       await prisma.quote.create({ data: {
         requestId: r.id, companyId: companies[i % 2].id, priceTry, crewSize: 3, vehicleType: 'KAMYON', validUntil: later,
       } });
     }`,
    { FROM: fromCityCode, TO: toCityCode, PREFIX: phonePrefix, PRICES: JSON.stringify(prices) },
  );
}
