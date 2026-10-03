import { contentHeadings, htmlToText, renderContent } from "./content";

/**
 * Blog içeriği WordPress'ten (headless, cms.evdenevenakliyat.app) REST API ile okunur.
 * WordPress yalnızca editör; okur yazıları evdenevenakliyat.app/blog altında görür.
 *
 * WORDPRESS_URL yoksa blog boş görünür (WordPress henüz kurulmadıysa site yine derlenir ve çalışır).
 * Yanıtlar BLOG_CACHE_TAG ile önbelleğe alınır; WordPress yazı yayınlayınca /api/blog/yenile çağrılır.
 */
export const WORDPRESS_URL = (process.env.WORDPRESS_URL ?? "").trim().replace(/\/+$/, "");
export const BLOG_ENABLED = /^https?:\/\//.test(WORDPRESS_URL);

export const BLOG_CACHE_TAG = "blog";
/** Webhook gelmese bile içerik en geç bu kadar saniyede yenilenir */
export const BLOG_REVALIDATE = 3600;
export const BLOG_PAGE_SIZE = 12;
export const BLOG_PATH = "/blog";

const TIMEOUT_MS = 8000;

export class WordPressError extends Error {}

export type BlogImage = { src: string; srcSet?: string; width: number; height: number; alt: string };
export type BlogCategory = { id: number; slug: string; name: string; description: string; count: number };
export type BlogAuthor = { name: string; bio: string };

export type BlogPostSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  modifiedAt: string;
  image: BlogImage | null;
  categories: BlogCategory[];
};

export type BlogPost = BlogPostSummary & {
  html: string;
  headings: { id: string; text: string }[];
  author: BlogAuthor | null;
  seoTitle: string;
  seoDescription: string;
  wordCount: number;
  readingMinutes: number;
};

export type BlogPage = { posts: BlogPostSummary[]; total: number; totalPages: number };

// ─── WordPress REST yanıt tipleri (yalnızca kullanılan alanlar) ─────────────

type WpRendered = { rendered: string };
type WpMediaSize = { source_url: string; width: number; height: number };
type WpMedia = {
  source_url: string;
  alt_text?: string;
  media_details?: { width?: number; height?: number; sizes?: Record<string, WpMediaSize> };
};
type WpTerm = { id: number; slug: string; name: string; taxonomy: string; description?: string; count?: number };
type WpPost = {
  id: number;
  slug: string;
  date_gmt: string;
  modified_gmt: string;
  title: WpRendered;
  excerpt: WpRendered;
  content?: WpRendered;
  yoast_head_json?: { title?: string; description?: string };
  _embedded?: {
    author?: { name?: string; description?: string }[];
    "wp:featuredmedia"?: (WpMedia | { code: string })[];
    "wp:term"?: WpTerm[][];
  };
};
type WpCategory = { id: number; slug: string; name: string; description: string; count: number };

async function wpFetch<T>(path: string, params: Record<string, string | number>) {
  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: BLOG_REVALIDATE, tags: [BLOG_CACHE_TAG] },
    });
  } catch (err) {
    throw new WordPressError(`WordPress'e ulaşılamadı: ${(err as Error).message}`);
  }
  // Son sayfadan sonrası WordPress'te 400 döner: boş sayfa olarak ele alınır
  if (res.status === 400 && params.page !== undefined) return { data: [] as T, total: 0, totalPages: 0 };
  if (!res.ok) throw new WordPressError(`WordPress ${res.status} döndü: ${url.pathname}`);
  return {
    data: (await res.json()) as T,
    total: Number(res.headers.get("x-wp-total") ?? 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  };
}

// ─── Dönüştürme ─────────────────────────────────────────────────────────────

/** WordPress GMT tarihleri saat dilimi eki olmadan gelir */
const gmt = (value: string) => (value.endsWith("Z") ? value : `${value}Z`);

function featuredImage(post: WpPost): BlogImage | null {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media || !("source_url" in media)) return null;
  const sizes = Object.values(media.media_details?.sizes ?? {}).filter((s) => s.width > 0 && s.height > 0);
  const width = media.media_details?.width ?? sizes.at(-1)?.width;
  const height = media.media_details?.height ?? sizes.at(-1)?.height;
  if (!width || !height) return null;
  // Aynı oranda olmayan (kırpılmış) boyutlar srcset'e girmez
  const ratio = width / height;
  const candidates = [...sizes, { source_url: media.source_url, width, height }]
    .filter((s) => Math.abs(s.width / s.height - ratio) < 0.02)
    .sort((a, b) => a.width - b.width)
    .filter((s, i, all) => all.findIndex((o) => o.width === s.width) === i);
  // Ana görsel en fazla 1600 px: telefona gereksiz büyük dosya inmesin
  const src = candidates.filter((s) => s.width <= 1600).at(-1) ?? candidates[0];
  return {
    src: src.source_url,
    srcSet: candidates.length > 1 ? candidates.map((s) => `${s.source_url} ${s.width}w`).join(", ") : undefined,
    width: src.width,
    height: src.height,
    alt: media.alt_text ?? "",
  };
}

function categoriesOf(post: WpPost): BlogCategory[] {
  return (post._embedded?.["wp:term"] ?? [])
    .flat()
    .filter((t) => t.taxonomy === "category" && t.slug !== "uncategorized" && t.slug !== "genel")
    .map((t) => ({ id: t.id, slug: t.slug, name: htmlToText(t.name), description: "", count: t.count ?? 0 }));
}

function toSummary(post: WpPost): BlogPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: htmlToText(post.title.rendered),
    excerpt: htmlToText(post.excerpt.rendered).replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, "…"),
    publishedAt: gmt(post.date_gmt),
    modifiedAt: gmt(post.modified_gmt),
    image: featuredImage(post),
    categories: categoriesOf(post),
  };
}

function toPost(post: WpPost): BlogPost {
  const summary = toSummary(post);
  const html = renderContent(post.content?.rendered ?? "", WORDPRESS_URL, { eagerFirstImage: !summary.image });
  const wordCount = htmlToText(html).split(/\s+/).filter(Boolean).length;
  const author = post._embedded?.author?.[0];
  const yoast = post.yoast_head_json;
  return {
    ...summary,
    html,
    headings: contentHeadings(html),
    author: author?.name ? { name: author.name, bio: htmlToText(author.description ?? "") } : null,
    // Yoast başlığında site adı da olur ("... - Blog"); site kendi şablonunu eklediği için yalnızca yazı başlığı kullanılır
    seoTitle: summary.title,
    seoDescription: (yoast?.description || summary.excerpt).slice(0, 300),
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
  };
}

/** WordPress kısa adı: Türkçe harfler yüzde kodlu da gelebilir; yol ayırıcı ve boşluk olamaz */
const validSlug = (slug: string) => slug.length > 0 && slug.length <= 200 && !/[\s/?#]/.test(slug);

const EMBED = "author,wp:featuredmedia,wp:term";
const LIST_FIELDS = "id,slug,date_gmt,modified_gmt,title,excerpt,_links,_embedded";

// ─── Okuma ──────────────────────────────────────────────────────────────────

/** Yazı listesi. WordPress yoksa veya ulaşılamıyorsa boş liste (liste sayfaları hata vermesin). */
export async function getPosts({
  page = 1,
  categoryId,
  perPage = BLOG_PAGE_SIZE,
}: { page?: number; categoryId?: number; perPage?: number } = {}): Promise<BlogPage> {
  if (!BLOG_ENABLED) return { posts: [], total: 0, totalPages: 0 };
  try {
    const { data, total, totalPages } = await wpFetch<WpPost[]>("posts", {
      page,
      per_page: perPage,
      _embed: EMBED,
      _fields: LIST_FIELDS,
      ...(categoryId && { categories: categoryId }),
    });
    return { posts: data.map(toSummary), total, totalPages };
  } catch (err) {
    console.error("[blog] yazı listesi alınamadı", err);
    return { posts: [], total: 0, totalPages: 0 };
  }
}

/**
 * Tek yazı. Bulunamazsa null. WordPress'e ulaşılamazsa hata fırlatır: önbellekteki eski sayfa
 * yerinde kalır, yazı yanlışlıkla 404 olmaz.
 */
export async function getPost(slug: string): Promise<BlogPost | null> {
  if (!BLOG_ENABLED || !validSlug(slug)) return null;
  const { data } = await wpFetch<WpPost[]>("posts", { slug, _embed: EMBED });
  return data[0] ? toPost(data[0]) : null;
}

/** Yazısı olan kategoriler (site haritası, kategori bağlantıları) */
export async function getCategories(): Promise<BlogCategory[]> {
  if (!BLOG_ENABLED) return [];
  try {
    const { data } = await wpFetch<WpCategory[]>("categories", {
      per_page: 100,
      hide_empty: "true",
      orderby: "count",
      order: "desc",
      _fields: "id,slug,name,description,count",
    });
    return data
      .filter((c) => c.slug !== "uncategorized" && c.slug !== "genel")
      .map((c) => ({ ...c, name: htmlToText(c.name), description: htmlToText(c.description) }));
  } catch (err) {
    console.error("[blog] kategoriler alınamadı", err);
    return [];
  }
}

/** Tek kategori. WordPress'e ulaşılamazsa hata fırlatır (sayfa yanlışlıkla 404 olmaz). */
export async function getCategory(slug: string): Promise<BlogCategory | null> {
  if (!BLOG_ENABLED || !validSlug(slug) || slug === "uncategorized" || slug === "genel") return null;
  const { data } = await wpFetch<WpCategory[]>("categories", { slug, _fields: "id,slug,name,description,count" });
  const category = data[0];
  return category ? { ...category, name: htmlToText(category.name), description: htmlToText(category.description) } : null;
}

/** Site haritası ve llms.txt için tüm yazılar (en fazla 1000) */
export async function getAllPostSummaries(): Promise<BlogPostSummary[]> {
  if (!BLOG_ENABLED) return [];
  const all: BlogPostSummary[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, totalPages } = await wpFetch<WpPost[]>("posts", {
        page,
        per_page: 100,
        _fields: "id,slug,date_gmt,modified_gmt,title,excerpt",
      });
      all.push(...data.map(toSummary));
      if (page >= totalPages) break;
    }
  } catch (err) {
    console.error("[blog] yazılar alınamadı", err);
  }
  return all;
}

export const postPath = (post: { slug: string }) => `${BLOG_PATH}/${post.slug}`;
export const categoryPath = (category: { slug: string }) => `${BLOG_PATH}/kategori/${category.slug}`;
export const pagePath = (base: string, page: number) => (page <= 1 ? base : `${base}/sayfa/${page}`);
