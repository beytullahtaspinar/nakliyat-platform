import { ApiError, apiFetch } from "@/lib/api";
import { contentHeadings, htmlToText, renderContent } from "./content";
import { BLOG_CACHE_TAG, BLOG_PAGE_SIZE, BLOG_REVALIDATE, SLUG_PATTERN } from "./rules";

export * from "./rules";

/**
 * Blog içeriği API'den (yönetim panelinde yazılır). Yanıtlar BLOG_CACHE_TAG ile önbelleğe alınır;
 * yönetimde yazı kaydedilince etiketin süresi hemen biter (lib/actions/blog.ts).
 */
export type BlogImage = {
  src: string;
  width: number;
  height: number;
  thumb: { src: string; width: number; height: number };
  alt: string;
};
export type BlogCategory = { slug: string; name: string; description: string | null; postCount: number };
export type BlogAuthor = {
  slug: string;
  name: string;
  jobTitle: string | null;
  bio: string | null;
  photo: BlogImage | null;
  sameAs: string[];
};
export type BlogFaqItem = { question: string; answer: string };

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  /** Okura gösterilen güncelleme tarihi: önemli değişiklik yoksa yayın tarihi */
  updatedAt: string;
  cover: BlogImage | null;
  category: { slug: string; name: string } | null;
  authorSlug: string | null;
  authorName: string | null;
};

type ApiPost = BlogPostSummary & {
  summary: string | null;
  content: string;
  faq: BlogFaqItem[];
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  author: BlogAuthor | null;
  images: Record<string, BlogImage>;
};

export type BlogPost = Omit<ApiPost, "content" | "images" | "seoTitle" | "seoDescription"> & {
  html: string;
  headings: { id: string; text: string }[];
  seoTitle: string;
  seoDescription: string;
  wordCount: number;
  readingMinutes: number;
};

export type BlogPage = { posts: BlogPostSummary[]; total: number; totalPages: number };
export type BlogIndex = {
  posts: (BlogPostSummary & { noindex: boolean; lastModified: string })[];
  categories: BlogCategory[];
  authors: { slug: string; name: string; updatedAt: string }[];
};

const cached = { revalidate: BLOG_REVALIDATE, tags: [BLOG_CACHE_TAG] };
const EMPTY_PAGE: BlogPage = { posts: [], total: 0, totalPages: 0 };
const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  return search.toString();
};

/** Yazı listesi. API'ye ulaşılamıyorsa boş liste (liste sayfaları hata vermesin). */
export async function getPosts({
  page = 1,
  category,
  author,
  perPage = BLOG_PAGE_SIZE,
}: { page?: number; category?: string; author?: string; perPage?: number } = {}): Promise<BlogPage> {
  try {
    const data = await apiFetch<{ items: BlogPostSummary[]; total: number; totalPages: number }>(
      `/blog/posts?${qs({ page, limit: perPage, category, author })}`,
      cached,
    );
    return { posts: data.items, total: data.total, totalPages: data.totalPages };
  } catch (err) {
    console.error("[blog] yazı listesi alınamadı", err);
    return EMPTY_PAGE;
  }
}

/**
 * Tek yazı. Bulunamazsa null, eski adresse { redirect }. API'ye ulaşılamazsa hata fırlatır:
 * önbellekteki eski sayfa yerinde kalır, yazı yanlışlıkla 404 olmaz.
 */
export async function getPost(slug: string): Promise<BlogPost | { redirect: string } | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 200) return null;
  let data: ApiPost | { redirect: string };
  try {
    data = await apiFetch<ApiPost | { redirect: string }>(`/blog/posts/${slug}`, cached);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
  if ("redirect" in data) return data;
  const { content, images, seoTitle, seoDescription, ...rest } = data;
  const html = renderContent(content, { images, eagerFirstImage: !data.cover });
  const wordCount = htmlToText(html).split(/\s+/).filter(Boolean).length;
  return {
    ...rest,
    html,
    headings: contentHeadings(html),
    seoTitle: seoTitle || data.title,
    seoDescription: (seoDescription || data.excerpt).slice(0, 300),
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
  };
}

/** Yazısı olan kategoriler */
export async function getCategories(): Promise<BlogCategory[]> {
  try {
    return await apiFetch<BlogCategory[]>("/blog/categories", cached);
  } catch (err) {
    console.error("[blog] kategoriler alınamadı", err);
    return [];
  }
}

/** Tek kategori ya da yazar: bulunamazsa null, API'ye ulaşılamazsa hata (sayfa yanlışlıkla 404 olmaz) */
async function getOne<T>(path: string, slug: string): Promise<T | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 200) return null;
  try {
    return await apiFetch<T>(`${path}/${slug}`, cached);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export const getCategory = (slug: string) => getOne<BlogCategory>("/blog/categories", slug);
export const getAuthor = (slug: string) => getOne<BlogAuthor & { postCount: number }>("/blog/authors", slug);

/** Site haritası, RSS ve llms.txt için yayındaki tüm yazılar */
export async function getBlogIndex(): Promise<BlogIndex> {
  try {
    return await apiFetch<BlogIndex>("/blog/index", cached);
  } catch (err) {
    console.error("[blog] yazı dizini alınamadı", err);
    return { posts: [], categories: [], authors: [] };
  }
}
