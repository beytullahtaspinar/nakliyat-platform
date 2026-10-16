/**
 * Blog kuralları ve adresleri. API'deki karşılığı: apps/api/src/blog/blog-rules.ts
 */
export const BLOG_PATH = "/blog";
/** Blog verisinin önbellek etiketi: yönetimde yazı kaydedilince süresi hemen biter */
export const BLOG_CACHE_TAG = "blog";
/** Zamanlanmış yazılar ve yönetim dışı değişiklikler için en geç bu kadar saniyede yenilenir */
export const BLOG_REVALIDATE = 900;
export const BLOG_PAGE_SIZE = 12;

export const BLOG_RULES = {
  titleMax: 200,
  slugMax: 120,
  excerptMin: 50,
  excerptMax: 400,
  summaryMax: 1200,
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
} as const;

/** Görseller tarayıcıda küçültülür: büyük hali ve liste kartları için önizleme */
export const BLOG_IMAGE_SIDE = 1600;
export const BLOG_THUMB_SIDE = 800;

/** Google sonuçlarında kesilmeden görünen yaklaşık uzunluklar */
export const SEO_TITLE_IDEAL = 60;
export const SEO_DESCRIPTION_IDEAL = { min: 120, max: 160 } as const;

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Taşınma Kontrol Listesi (2026)" → "tasinma-kontrol-listesi-2026" */
export function blogSlugify(text: string, max: number = BLOG_RULES.slugMax): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const postPath = (post: { slug: string }) => `${BLOG_PATH}/${post.slug}`;
export const categoryPath = (category: { slug: string }) => `${BLOG_PATH}/kategori/${category.slug}`;
export const authorPath = (author: { slug: string }) => `${BLOG_PATH}/yazar/${author.slug}`;
export const pagePath = (base: string, page: number) => (page <= 1 ? base : `${base}/sayfa/${page}`);
