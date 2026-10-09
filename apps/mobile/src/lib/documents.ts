import type { CompanyDocument, CompanyDocumentSummary, DocumentRequirement, DocumentType, UploadTicket } from '@nakliyat/api-client';
import type { Tone } from './requests';
import { api } from './api';

/** Sitedeki apps/web/src/lib/company-documents.ts ile aynı kurallar ve metinler */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_OTHER_DOCUMENTS = 5;

export const DOCUMENT_TYPES: { type: DocumentType; label: string; required: boolean; dated?: boolean; hint: string }[] = [
  {
    type: 'K3_LICENSE',
    label: 'K3 yetki belgesi',
    required: true,
    dated: true,
    hint: "Ulaştırma ve Altyapı Bakanlığı'ndan alınan K3 yetki belgesi. e-Devlet çıktısı da olur.",
  },
  {
    type: 'TAX_CERTIFICATE',
    label: 'Vergi levhası',
    required: true,
    hint: "GİB'den (Hazır Beyan / İnteraktif Vergi Dairesi) indirilen güncel vergi levhası.",
  },
  {
    type: 'TRADE_REGISTRY',
    label: 'Ticaret sicil gazetesi / faaliyet belgesi',
    required: true,
    hint: 'Şirketin kuruluş ilanı ya da odadan alınan güncel faaliyet belgesi.',
  },
  {
    type: 'INSURANCE',
    label: 'Sigorta poliçesi',
    required: false,
    hint: 'Varsa nakliyat (emtia) sigortası poliçesi. Müşteriler için güven unsuru.',
  },
  {
    type: 'OTHER',
    label: 'Ek belge',
    required: false,
    hint: `Eklemek istediğin diğer belgeler (ör. imza sirküleri). En fazla ${MAX_OTHER_DOCUMENTS} dosya.`,
  },
];

export const REQUIREMENT_STATES: Record<DocumentRequirement['state'], { label: string; tone: Tone }> = {
  VERIFIED: { label: 'Onaylandı', tone: 'success' },
  PENDING: { label: 'İnceleniyor', tone: 'accent' },
  REJECTED: { label: 'Reddedildi', tone: 'warning' },
  EXPIRED: { label: 'Süresi dolmuş', tone: 'warning' },
  MISSING: { label: 'Yüklenmedi', tone: 'neutral' },
};

export const documentState = (d: CompanyDocument): DocumentRequirement['state'] =>
  d.status === 'VERIFIED' && d.expired ? 'EXPIRED' : d.status;

export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** "2029-05-31" → "31 Mayıs 2029" */
export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const expiresSoon = (day: string | null) =>
  day !== null && new Date(`${day}T00:00:00Z`).getTime() - Date.now() < 30 * 86_400_000;

/** "31.05.2029" → "2029-05-31"; geçersizse null */
export function parseDay(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

const BY_EXTENSION: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

export const mimeOf = (f: PickedFile) => f.mimeType || BY_EXTENSION[f.name.split('.').pop()?.toLowerCase() ?? ''] || '';

/** Dosyayı yükleme adresine gönderir ve belge olarak kaydeder (sitedeki akışın aynısı) */
export async function uploadDocument(file: PickedFile, type: DocumentType, validUntil?: string) {
  const mimeType = mimeOf(file);
  const blob = await (await fetch(file.uri)).blob();
  const ticket = await api.request<UploadTicket>('/company/documents/uploads', {
    method: 'POST',
    body: { mimeType, sizeBytes: blob.size },
  });
  const res = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: blob });
  if (!res.ok) throw new Error('Dosya yüklenemedi, bağlantını kontrol edip tekrar dene.');
  return api.request<CompanyDocumentSummary>('/company/documents', {
    method: 'POST',
    body: { type, key: ticket.key, fileName: file.name, ...(validUntil && { validUntil }) },
  });
}
