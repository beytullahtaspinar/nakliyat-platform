import { apiFetch } from "@/lib/api";
import type { BlogFaqItem, BlogImage } from "@/lib/blog/api";
import { renderContent } from "@/lib/blog/content";

/**
 * Bölge sayfalarının (il, ilçe, güzergâh, /evden-eve-nakliyat) yönetimden yazılan içeriği.
 * Boş alanın yerine sayfanın otomatik metni kullanılır. API'deki karşılığı: apps/api/src/blog/local-pages.service.ts
 */
export const LOCAL_PAGE_CACHE_TAG = "bolge-sayfalari";

export const LOCAL_PAGE_RULES = { headingMax: 120, introMax: 1500 } as const;

/** GET /local-pages ve /admin/local-pages/:slug yanıtı */
export type LocalPageContent = {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  heading: string | null;
  intro: string | null;
  content: string | null;
  faq: BlogFaqItem[];
  coverKey: string | null;
  cover: BlogImage | null;
  images: Record<string, BlogImage>;
  updatedAt: string;
};

export type LocalPageView = LocalPageContent & { html: string | null };

/**
 * Sayfanın düzenlenmiş içeriği; düzenlenmediyse ya da API'ye ulaşılamazsa null (sayfa otomatik metinle çizilir).
 * Yüzlerce bölge sayfası tek yanıtı paylaşır; yönetimde kaydedilince etiketle hemen yenilenir.
 */
export async function getLocalPageContent(slug: string): Promise<LocalPageView | null> {
  try {
    const { items } = await apiFetch<{ items: LocalPageContent[] }>("/local-pages", {
      revalidate: 3600,
      tags: [LOCAL_PAGE_CACHE_TAG],
    });
    const page = items.find((p) => p.slug === slug);
    if (!page) return null;
    return { ...page, html: page.content ? renderContent(page.content, { images: page.images }) : null };
  } catch {
    return null;
  }
}
