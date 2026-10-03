import { Injectable } from '@nestjs/common';
import type { Company } from '../generated/prisma/client.js';
import { VerificationStatus } from '../generated/prisma/enums.js';
import { DOCUMENT_LABELS, REQUIRED_DOCUMENT_TYPES, requirementState } from '../media/company-document-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BADGE_RULES,
  type BadgeCode,
  earnsFastResponse,
  earnsTopRated,
  type FastResponseStats,
  median,
} from './badge-rules.js';

type BadgeInput = Pick<Company, 'id' | 'verificationStatus' | 'ratingAverage' | 'ratingCount'>;

const DAY_MS = 24 * 60 * 60_000;

/** Firma rozetlerini güncel veriden hesaplar (bkz. badge-rules.ts) */
@Injectable()
export class CompanyBadgesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Müşteriye gösterilen rozetler, firma kimliğine göre (teklif listesi, firma sayfası) */
  async forCompanies(companies: BadgeInput[], now = new Date()): Promise<Map<string, BadgeCode[]>> {
    const ids = [...new Set(companies.map((c) => c.id))];
    if (ids.length === 0) return new Map();
    const [missing, response] = await Promise.all([this.missingDocuments(ids, now), this.responseStats(ids, now)]);
    return new Map(
      companies.map((c) => {
        const badges: BadgeCode[] = [];
        if (c.verificationStatus === VerificationStatus.VERIFIED && missing.get(c.id)!.length === 0)
          badges.push('DOCUMENTS_VERIFIED');
        if (earnsFastResponse(response.get(c.id)!)) badges.push('FAST_RESPONSE');
        if (earnsTopRated(Number(c.ratingAverage), c.ratingCount)) badges.push('TOP_RATED');
        return [c.id, badges];
      }),
    );
  }

  /** Firma paneli: her rozet için kazanıldı mı ve ne kadar yakın */
  async progress(company: BadgeInput, now = new Date()) {
    const [missing, response] = await Promise.all([
      this.missingDocuments([company.id], now),
      this.responseStats([company.id], now),
    ]);
    const missingTypes = missing.get(company.id)!;
    const stats = response.get(company.id)!;
    const ratingAverage = Number(company.ratingAverage);
    return {
      documents: {
        earned: company.verificationStatus === VerificationStatus.VERIFIED && missingTypes.length === 0,
        companyVerified: company.verificationStatus === VerificationStatus.VERIFIED,
        missing: missingTypes.map((type) => DOCUMENT_LABELS[type]),
      },
      fastResponse: {
        earned: earnsFastResponse(stats),
        ...stats,
        ...BADGE_RULES.fastResponse,
      },
      topRated: {
        earned: earnsTopRated(ratingAverage, company.ratingCount),
        ratingAverage,
        ratingCount: company.ratingCount,
        ...BADGE_RULES.topRated,
      },
    };
  }

  /** Onaylı ve süresi geçerli belgesi olmayan zorunlu türler */
  private async missingDocuments(ids: string[], now: Date) {
    const documents = await this.prisma.companyDocument.findMany({
      where: { companyId: { in: ids }, type: { in: REQUIRED_DOCUMENT_TYPES }, status: VerificationStatus.VERIFIED },
      select: { companyId: true, type: true, status: true, validUntil: true, createdAt: true },
    });
    return new Map(
      ids.map((id) => {
        const own = documents.filter((d) => d.companyId === id);
        return [id, REQUIRED_DOCUMENT_TYPES.filter((type) => requirementState(own, type, now) !== 'VERIFIED')];
      }),
    );
  }

  /** Son 90 günde verilen teklifler: talep yayına girdikten kaç dakika sonra verildi (ortanca) */
  private async responseStats(ids: string[], now: Date) {
    const { windowDays } = BADGE_RULES.fastResponse;
    const quotes = await this.prisma.quote.findMany({
      where: {
        companyId: { in: ids },
        createdAt: { gte: new Date(now.getTime() - windowDays * DAY_MS) },
        request: { publishedAt: { not: null } },
      },
      select: { companyId: true, createdAt: true, request: { select: { publishedAt: true } } },
    });
    return new Map<string, FastResponseStats>(
      ids.map((id) => {
        const minutes = quotes
          .filter((q) => q.companyId === id)
          .map((q) => Math.max(0, (q.createdAt.getTime() - q.request.publishedAt!.getTime()) / 60_000));
        const m = median(minutes);
        return [id, { quoteCount: minutes.length, medianMinutes: m === null ? null : Math.round(m) }];
      }),
    );
  }
}
