/**
 * Blog kuralları. Web tarafındaki karşılığı: apps/web/src/lib/blog/rules.ts
 */
export const BLOG_RULES = {
  titleMax: 200,
  slugMax: 120,
  excerptMin: 50,
  excerptMax: 400,
  summaryMax: 1200,
  contentMax: 200_000,
  /** Yayınlanan yazının en kısa içeriği (karakter): daha kısası "ince içerik" sayılır */
  publishMinContent: 600,
  seoTitleMax: 70,
  seoDescriptionMax: 170,
  faqMax: 20,
  faqQuestionMax: 200,
  faqAnswerMax: 1500,
  coverAltMax: 200,
  categoryNameMax: 80,
  categoryDescriptionMax: 400,
  authorNameMax: 100,
  authorJobTitleMax: 120,
  authorBioMax: 2000,
  sameAsMax: 6,
  /** Görseller tarayıcıda küçültülür: büyük 1600 px, önizleme 800 px WebP */
  imageMaxBytes: 2 * 1024 * 1024,
  thumbMaxBytes: 500 * 1024,
  mimeTypes: ['image/webp', 'image/jpeg'],
} as const;

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** "Taşınma Kontrol Listesi (2026)" → "tasinma-kontrol-listesi-2026" */
export function slugify(text: string, max: number = BLOG_RULES.slugMax): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** Adreste kullanılabilecek kısa ad: küçük harf, rakam ve tire */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Blog görselinin depo anahtarı: blog/<32 hex>.webp */
export const BLOG_MEDIA_KEY_PATTERN = /^blog\/[a-f0-9]{32}\.(webp|jpg)$/;

/** İçerikteki blog görseli adresleri: /medya/blog/<32 hex>.webp */
const CONTENT_IMAGE = /\/medya\/(blog\/[a-f0-9]{32}\.(?:webp|jpg))/g;

export const blogMediaPath = (key: string) => `/medya/${key}`;

/** İçerikte geçen blog görsellerinin depo anahtarları */
export const contentImageKeys = (content: string) => [...new Set([...content.matchAll(CONTENT_IMAGE)].map((m) => m[1]))];
