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
