import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SETTINGS_ID = 1;
export const VERIFICATION_CODE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export type SearchVerification = { google: string | null; bing: string | null; yandex: string | null };
const ENGINES = ['google', 'bing', 'yandex'] as const;

/** Kayıttaki değeri okur; geçersiz ya da eksik alan boş sayılır (sitede bozuk meta etiketi basılmasın) */
function parse(raw: unknown): SearchVerification {
  const v = ((raw as { verification?: Record<string, unknown> } | null)?.verification ?? {}) as Record<string, unknown>;
  const code = (x: unknown) => (typeof x === 'string' && VERIFICATION_CODE_PATTERN.test(x) ? x : null);
  return { google: code(v.google), bing: code(v.bing), yandex: code(v.yandex) };
}

/**
 * Site geneli ayarlar: arama motoru doğrulama kodları. Kodlar herkese açıktır (ana sayfada meta etiketi olarak
 * yayınlanır), gizli değildir. Yönetimden değiştirilir, önceki ve yeni değer karar geçmişine yazılır.
 */
@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<{ verification: SearchVerification; updatedAt: Date | null }> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
    return { verification: parse(row?.settings), updatedAt: row?.updatedAt ?? null };
  }

  async update(adminId: string, changes: Partial<SearchVerification>) {
    const { verification: before } = await this.get();
    const after = { ...before };
    for (const engine of ENGINES) if (changes[engine] !== undefined) after[engine] = changes[engine];
    const settings = { verification: after } as unknown as Prisma.InputJsonValue;
    await this.prisma.$transaction([
      this.prisma.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, settings, updatedById: adminId },
        update: { settings, updatedById: adminId },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'site-settings.update',
          entityType: 'SiteSettings',
          entityId: String(SETTINGS_ID),
          details: { before, after },
        },
      }),
    ]);
    return this.get();
  }
}
