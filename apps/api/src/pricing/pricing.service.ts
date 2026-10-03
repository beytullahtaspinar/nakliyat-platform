import { Injectable } from '@nestjs/common';
import {
  DEFAULT_PRICING_SETTINGS,
  calibrate,
  normalizeSettings,
  type Calibration,
  type HomeType,
  type PriceSample,
  type PricingSettings,
} from '@nakliyat/pricing';
import { BookingStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SETTINGS_ID = 1;
/** Ayarlama birkaç dakikada bir yeniden hesaplanır: herkese açık sayfa her ziyarette veritabanını taramasın */
const CALIBRATION_TTL_MS = 10 * 60_000;

/**
 * Fiyat hesaplayıcı: yönetimin katsayıları ve platformdaki anlaşmalarla ayarlama.
 * Hesabın kendisi tarayıcıda @nakliyat/pricing ile yapılır; API yalnızca katsayıları ve ayarlamayı verir.
 */
@Injectable()
export class PricingService {
  private cached?: { at: number; key: string; value: Calibration };

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<{ settings: PricingSettings; updatedAt: Date | null }> {
    const row = await this.prisma.pricingSettings.findUnique({ where: { id: SETTINGS_ID } });
    return { settings: normalizeSettings(row?.settings), updatedAt: row?.updatedAt ?? null };
  }

  /** Herkese açık hesaplayıcının ihtiyaç duyduğu her şey */
  async publicModel() {
    const { settings, updatedAt } = await this.getSettings();
    return { settings, calibration: await this.getCalibration(settings), updatedAt };
  }

  /** Yönetim ekranı: katsayılar, varsayılanlar ve hangi grubun platform verisiyle ayarlandığı */
  async adminView() {
    const { settings, updatedAt } = await this.getSettings();
    const samples = await this.samples(settings.lookbackDays);
    const counts = { local: 0, intercity: 0 };
    for (const s of samples) counts[s.input.distanceKm ? 'intercity' : 'local']++;
    return { settings, defaults: DEFAULT_PRICING_SETTINGS, calibration: await this.getCalibration(settings), sampleCounts: counts, updatedAt };
  }

  async update(adminId: string, changes: Partial<PricingSettings>) {
    const { settings: before } = await this.getSettings();
    const after = normalizeSettings({ ...before, ...changes });
    await this.prisma.$transaction([
      this.prisma.pricingSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, settings: { ...after }, updatedById: adminId },
        update: { settings: { ...after }, updatedById: adminId },
      }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'pricing.update', entityType: 'PricingSettings', entityId: String(SETTINGS_ID), details: { before: { ...before }, after: { ...after } } },
      }),
    ]);
    this.cached = undefined;
    return this.adminView();
  }

  private async getCalibration(settings: PricingSettings): Promise<Calibration> {
    const key = JSON.stringify(settings);
    if (this.cached && this.cached.key === key && Date.now() - this.cached.at < CALIBRATION_TTL_MS) return this.cached.value;
    const value = calibrate(await this.samples(settings.lookbackDays), settings);
    this.cached = { at: Date.now(), key, value };
    return value;
  }

  /** Dönemdeki iptal edilmemiş anlaşmalar: kabul edilen teklif fiyatı + talebin bilgileri */
  private async samples(lookbackDays: number): Promise<PriceSample[]> {
    const since = new Date(Date.now() - lookbackDays * 86_400_000);
    const bookings = await this.prisma.booking.findMany({
      where: { createdAt: { gte: since }, status: { not: BookingStatus.CANCELLED } },
      select: {
        quote: { select: { priceTry: true } },
        request: {
          select: {
            homeType: true,
            fromCityCode: true,
            toCityCode: true,
            distanceKm: true,
            fromFloor: true,
            fromHasElevator: true,
            toFloor: true,
            toHasElevator: true,
            needsPacking: true,
            needsAssembly: true,
          },
        },
      },
    });
    return bookings.map(({ quote, request: { homeType, fromCityCode, toCityCode, distanceKm, ...rest } }) => ({
      priceTry: Number(quote.priceTry),
      input: {
        ...rest,
        homeType: homeType as HomeType,
        // Hesaplayıcıyla aynı ölçü: il merkezleri arası mesafe, aynı ilde boş
        distanceKm: fromCityCode !== toCityCode && distanceKm ? distanceKm : undefined,
      },
    }));
  }
}
