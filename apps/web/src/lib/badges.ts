import type { BadgeCode, BadgeProgress } from "@/lib/api";

/**
 * Firma rozetleri. Kurallar API'de hesaplanır (apps/api/src/companies/badge-rules.ts);
 * buradaki metinler eşiklerle uyumlu tutulmalı.
 */
export const BADGES: Record<BadgeCode, { label: string; description: string }> = {
  DOCUMENTS_VERIFIED: {
    label: "Belgeleri onaylı",
    description: "K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı ekibimizce onaylandı; K3 belgesinin süresi geçerli.",
  },
  FAST_RESPONSE: {
    label: "Hızlı yanıt",
    description: "Son 90 günde taleplere genellikle 3 saat içinde teklif verdi (en az 5 teklif).",
  },
  TOP_RATED: {
    label: "Yüksek puanlı",
    description: "En az 5 müşteri yorumunda ortalama 4,5 ve üzeri puan aldı.",
  },
};

export const BADGE_ORDER: BadgeCode[] = ["DOCUMENTS_VERIFIED", "FAST_RESPONSE", "TOP_RATED"];

/** Rozet kodunun panel ilerleme yanıtındaki alanı */
export const BADGE_KEYS = {
  DOCUMENTS_VERIFIED: "documents",
  FAST_RESPONSE: "fastResponse",
  TOP_RATED: "topRated",
} as const satisfies Record<BadgeCode, keyof BadgeProgress>;

/** 45 → "45 dakika", 130 → "2 saat 10 dakika", 1500 → "1 gün 1 saat" */
export function formatMinutes(total: number): string {
  if (total < 60) return `${Math.max(1, Math.round(total))} dakika`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = Math.round(total % 60);
  if (days > 0) return hours > 0 ? `${days} gün ${hours} saat` : `${days} gün`;
  return minutes > 0 ? `${hours} saat ${minutes} dakika` : `${hours} saat`;
}

const rating = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Firma panelinde her rozet için durum cümlesi */
export function badgeStatus(code: BadgeCode, p: BadgeProgress): string {
  switch (code) {
    case "DOCUMENTS_VERIFIED":
      if (p.documents.earned) return "Zorunlu belgelerin onaylı ve geçerli.";
      if (!p.documents.companyVerified) return "Firman doğrulandığında ve zorunlu belgelerin onaylandığında kazanılır.";
      return `Eksik ya da süresi dolmuş: ${p.documents.missing.join(", ")}.`;
    case "FAST_RESPONSE": {
      const f = p.fastResponse;
      const median = f.medianMinutes === null ? null : formatMinutes(f.medianMinutes);
      if (f.quoteCount < f.minQuotes)
        return `Son ${f.windowDays} günde ${f.quoteCount} teklif verdin; rozet için en az ${f.minQuotes} teklif gerekir${median ? ` (şu an genellikle ${median} içinde teklif veriyorsun)` : ""}.`;
      return f.earned
        ? `Son ${f.windowDays} günde talepler yayına girdikten genellikle ${median} sonra teklif verdin.`
        : `Genellikle ${median} içinde teklif veriyorsun; rozet için ${formatMinutes(f.maxMedianMinutes)} gerekir.`;
    }
    case "TOP_RATED": {
      const t = p.topRated;
      if (t.ratingCount === 0) return `Henüz yorum yok; en az ${t.minCount} yorumda ${rating(t.minAverage)} ortalama gerekir.`;
      const now = `${t.ratingCount} yorum, ortalama ${rating(t.ratingAverage)}`;
      if (t.earned) return `${now}.`;
      if (t.ratingCount < t.minCount) return `${now}; rozet için en az ${t.minCount} yorum gerekir.`;
      return `${now}; rozet için ortalama ${rating(t.minAverage)} gerekir.`;
    }
  }
}
