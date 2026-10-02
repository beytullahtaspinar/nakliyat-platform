import type { CompanyDocument, DocumentRequirement } from "@/lib/api";

/** Firma doğrulama belgeleri. API'deki karşılığı: apps/api/src/media/company-document-rules.ts */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
export const MAX_OTHER_DOCUMENTS = 5;

export type DocumentType = CompanyDocument["type"];

export const DOCUMENT_TYPES: {
  type: DocumentType;
  label: string;
  required: boolean;
  /** Geçerlilik bitiş tarihi zorunlu mu */
  dated?: boolean;
  hint: string;
}[] = [
  {
    type: "K3_LICENSE",
    label: "K3 yetki belgesi",
    required: true,
    dated: true,
    hint: "Ulaştırma ve Altyapı Bakanlığı'ndan alınan K3 yetki belgesi. e-Devlet çıktısı da olur.",
  },
  {
    type: "TAX_CERTIFICATE",
    label: "Vergi levhası",
    required: true,
    hint: "GİB'den (Hazır Beyan / İnteraktif Vergi Dairesi) indirilen güncel vergi levhası.",
  },
  {
    type: "TRADE_REGISTRY",
    label: "Ticaret sicil gazetesi / faaliyet belgesi",
    required: true,
    hint: "Şirketin kuruluş ilanı ya da odadan alınan güncel faaliyet belgesi.",
  },
  {
    type: "INSURANCE",
    label: "Sigorta poliçesi",
    required: false,
    hint: "Varsa nakliyat (emtia) sigortası poliçesi. Müşteriler için güven unsuru.",
  },
  {
    type: "OTHER",
    label: "Ek belge",
    required: false,
    hint: `Eklemek istediğin diğer belgeler (ör. imza sirküleri). En fazla ${MAX_OTHER_DOCUMENTS} dosya.`,
  },
];

export const DOCUMENT_LABELS = Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.type, d.label])) as Record<
  DocumentType,
  string
>;

export const REQUIREMENT_STATES: Record<
  DocumentRequirement["state"],
  { label: string; tone: "success" | "warning" | "neutral" | "danger" }
> = {
  VERIFIED: { label: "Onaylandı", tone: "success" },
  PENDING: { label: "İnceleniyor", tone: "warning" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  EXPIRED: { label: "Süresi dolmuş", tone: "danger" },
  MISSING: { label: "Yüklenmedi", tone: "neutral" },
};

/** Belgenin durumu, süresi dolmuşsa "süresi dolmuş" olarak */
export const documentState = (d: CompanyDocument): DocumentRequirement["state"] =>
  d.status === "VERIFIED" && d.expired ? "EXPIRED" : d.status;

export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** "2029-05-31" → "31 Mayıs 2029" (saat dilimi kaymadan) */
export const formatDay = (day: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** Bitişine 30 günden az kalan belge */
export const expiresSoon = (day: string | null) =>
  day !== null && new Date(`${day}T00:00:00Z`).getTime() - Date.now() < 30 * 86_400_000;
