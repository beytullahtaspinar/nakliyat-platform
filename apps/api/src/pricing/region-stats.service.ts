import { Injectable } from '@nestjs/common';
import { PUBLIC_COMPANY } from '../companies/companies.service.js';
import { QuoteStatus, RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Son kaç günün teklifleri sayılır */
export const REGION_STATS_DAYS = 90;
/**
 * Bir ev tipinin satırı ancak bu kadar teklif ve bu kadar farklı firma varsa gösterilir:
 * az örnekte aralık yanıltır, tek firmada o firmanın fiyatı açığa çıkar.
 */
export const REGION_STATS_MIN_QUOTES = 5;
export const REGION_STATS_MIN_COMPANIES = 2;
/** Herkese açık bölge sayfaları her ziyarette veritabanını taramasın */
const TTL_MS = 10 * 60_000;

export type RegionStats = {
  fromCityCode: string;
  toCityCode: string;
  days: number;
  /** Dönemde teklif alan talep ve verilen teklif sayısı (gösterilmeyen ev tipleri dahil) */
  requestCount: number;
  quoteCount: number;
  /** Çıkış ilinde hizmet veren doğrulanmış firma sayısı */
  verifiedCompanyCount: number;
  /** Ev tipine göre tekliflerin ortadaki yarısı (çeyrekler) ve ortancası, TL */
  priceRanges: { homeType: string; quoteCount: number; companyCount: number; p25: number; median: number; p75: number }[];
  updatedAt: string;
};

/** Sıralı dizide doğrusal aradeğerlemeli yüzdelik, 10 TL'ye yuvarlı */
function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const value = sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
  return Math.round(value / 10) * 10;
}

/**
 * Bölge sayfalarındaki gerçek teklif verisi: bir il içindeki (from = to) ya da iki il arasındaki taşımalarda
 * firmaların verdiği teklifler. Geri çekilen teklifler ve taslak/silinmiş talepler sayılmaz; yalnızca herkese
 * açık (doğrulanmış) firmaların teklifleri. Hiçbir satır eşiği geçmezse priceRanges boş döner.
 */
@Injectable()
export class RegionStatsService {
  private readonly cache = new Map<string, { at: number; value: RegionStats }>();

  constructor(private readonly prisma: PrismaService) {}

  async get(fromCityCode: string, toCityCode: string): Promise<RegionStats> {
    const key = `${fromCityCode}-${toCityCode}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const value = await this.compute(fromCityCode, toCityCode);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private async compute(fromCityCode: string, toCityCode: string): Promise<RegionStats> {
    const since = new Date(Date.now() - REGION_STATS_DAYS * 86_400_000);
    const [quotes, verifiedCompanyCount] = await Promise.all([
      this.prisma.quote.findMany({
        where: {
          createdAt: { gte: since },
          status: { not: QuoteStatus.WITHDRAWN },
          company: PUBLIC_COMPANY,
          request: { fromCityCode, toCityCode, deletedAt: null, status: { not: RequestStatus.DRAFT } },
        },
        select: { priceTry: true, companyId: true, requestId: true, request: { select: { homeType: true } } },
      }),
      this.prisma.company.count({ where: { ...PUBLIC_COMPANY, serviceCities: { some: { cityCode: fromCityCode } } } }),
    ]);

    const byType = new Map<string, { prices: number[]; companies: Set<string> }>();
    for (const q of quotes) {
      const group = byType.get(q.request.homeType) ?? { prices: [], companies: new Set<string>() };
      group.prices.push(Number(q.priceTry));
      group.companies.add(q.companyId);
      byType.set(q.request.homeType, group);
    }
    const priceRanges = [...byType]
      .filter(([, g]) => g.prices.length >= REGION_STATS_MIN_QUOTES && g.companies.size >= REGION_STATS_MIN_COMPANIES)
      .map(([homeType, g]) => {
        const sorted = g.prices.sort((a, b) => a - b);
        return {
          homeType,
          quoteCount: sorted.length,
          companyCount: g.companies.size,
          p25: percentile(sorted, 0.25),
          median: percentile(sorted, 0.5),
          p75: percentile(sorted, 0.75),
        };
      });

    return {
      fromCityCode,
      toCityCode,
      days: REGION_STATS_DAYS,
      requestCount: new Set(quotes.map((q) => q.requestId)).size,
      quoteCount: quotes.length,
      verifiedCompanyCount,
      priceRanges,
      updatedAt: new Date().toISOString(),
    };
  }
}
