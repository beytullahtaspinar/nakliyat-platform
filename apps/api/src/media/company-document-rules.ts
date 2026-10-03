import type { CompanyDocument } from '../generated/prisma/client.js';
import { CompanyDocumentType, VerificationStatus } from '../generated/prisma/enums.js';

/**
 * Firma doğrulama belgeleri. Belgeler küçültülmez (PDF ya da telefonla çekilmiş fotoğraf).
 * Web tarafındaki karşılığı: apps/web/src/lib/company-documents.ts
 */
export const DOCUMENT_RULES = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Firma onaylanmadan önce her biri için onaylanmış bir belge gerekir */
export const REQUIRED_DOCUMENT_TYPES: CompanyDocumentType[] = [
  CompanyDocumentType.K3_LICENSE,
  CompanyDocumentType.TAX_CERTIFICATE,
  CompanyDocumentType.TRADE_REGISTRY,
];

/** Geçerlilik bitiş tarihi zorunlu olan belgeler */
export const DATED_DOCUMENT_TYPES: CompanyDocumentType[] = [CompanyDocumentType.K3_LICENSE];

/** "Diğer belge" türünde en fazla bu kadar dosya; diğer türlerde her türden bir güncel belge tutulur */
export const MAX_OTHER_DOCUMENTS = 5;

export const DOCUMENT_LABELS: Record<CompanyDocumentType, string> = {
  K3_LICENSE: 'K3 yetki belgesi',
  TAX_CERTIFICATE: 'Vergi levhası',
  TRADE_REGISTRY: 'Ticaret sicil gazetesi / faaliyet belgesi',
  INSURANCE: 'Sigorta poliçesi',
  OTHER: 'Diğer belge',
};

/** Bugünün tarihi Türkiye saatiyle, YYYY-AA-GG */
export const todayInTurkey = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

/** Geçerlilik tarihi bugünden önceyse belge süresi dolmuş sayılır (bitiş günü dahil geçerli) */
export const isExpired = (validUntil: Date | null, now = new Date()) =>
  validUntil !== null && validUntil.toISOString().slice(0, 10) < todayInTurkey(now);

/** Zorunlu belgenin durumu: onaylı, incelemede, reddedildi, süresi dolmuş ya da hiç yüklenmemiş */
export type RequirementState = 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED' | 'MISSING';

/** Bir türün durumu: onaylı ve süresi geçerli bir belge varsa VERIFIED, yoksa en yeni belgenin durumu */
export function requirementState(
  documents: Pick<CompanyDocument, 'type' | 'status' | 'validUntil' | 'createdAt'>[],
  type: CompanyDocumentType,
  now = new Date(),
): RequirementState {
  const ofType = documents
    .filter((d) => d.type === type)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (ofType.some((d) => d.status === VerificationStatus.VERIFIED && !isExpired(d.validUntil, now))) return 'VERIFIED';
  const latest = ofType[0];
  if (!latest) return 'MISSING';
  if (latest.status === VerificationStatus.VERIFIED) return 'EXPIRED';
  return latest.status;
}
