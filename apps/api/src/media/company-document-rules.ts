import { CompanyDocumentType } from '../generated/prisma/enums.js';

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
