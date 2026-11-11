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

const fetchLocalPageContents = async () =>
  (
    await apiFetch<{ items: LocalPageContent[] }>("/local-pages", {
      revalidate: 3600,
      tags: [LOCAL_PAGE_CACHE_TAG],
    })
  ).items;

/** Düzenlenmiş sayfaların son güncellenme zamanı ve kapak görseli (site haritası için); API'ye ulaşılamazsa boş */
export async function getLocalPageUpdates(): Promise<Map<string, { updatedAt: string; coverSrc: string | null }>> {
  try {
    return new Map(
      (await fetchLocalPageContents()).map((p) => [p.slug, { updatedAt: p.updatedAt, coverSrc: p.cover?.src ?? null }]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Sayfanın düzenlenmiş içeriği; düzenlenmediyse ya da API'ye ulaşılamazsa null (sayfa otomatik metinle çizilir).
 * Yüzlerce bölge sayfası tek yanıtı paylaşır; yönetimde kaydedilince etiketle hemen yenilenir.
 */
export async function getLocalPageContent(slug: string): Promise<LocalPageView | null> {
  try {
    const page = (await fetchLocalPageContents()).find((p) => p.slug === slug);
    if (!page) return null;
    return { ...page, html: page.content ? renderContent(page.content, { images: page.images }) : null };
  } catch {
    return null;
  }
}

/**
 * Yalnızca kapak görseli (ilçe sayfasında kendi kapağı yoksa il kapağı yedek olarak gösterilir).
 * Aynı önbellekli yanıtı kullanır, ek istek yapmaz.
 */
export async function getLocalPageCover(slug: string): Promise<BlogImage | null> {
  try {
    return (await fetchLocalPageContents()).find((p) => p.slug === slug)?.cover ?? null;
  } catch {
    return null;
  }
}
