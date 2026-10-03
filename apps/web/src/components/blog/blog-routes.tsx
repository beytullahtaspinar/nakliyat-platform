import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogListing } from "@/components/blog/blog-listing";
import {
  BLOG_PATH,
  categoryPath,
  getCategories,
  getCategory,
  getPosts,
  pagePath,
} from "@/lib/blog/wordpress";

/**
 * Blog liste sayfaları: /blog, /blog/sayfa/[n], /blog/kategori/[slug], /blog/kategori/[slug]/sayfa/[n].
 * Rota dosyaları yalnızca bu yardımcıları çağırır.
 */
export const BLOG_TITLE = "Taşınma Rehberi ve Nakliyat Blogu";
const BLOG_INTRO =
  "Evden eve nakliyat fiyatları, taşınma hazırlığı, paketleme ve doğru nakliyat firmasını seçme üzerine güncel rehberler.";

/** Adresteki sayfa numarası: 2 ve üstü. "1" ana adrese yönlenir, geçersizse 404. */
export function parsePage(value: string, basePath: string): number {
  if (value === "1") permanentRedirect(basePath);
  if (!/^[1-9]\d{0,3}$/.test(value)) notFound();
  return Number(value);
}

function listingMetadata({
  title,
  description,
  path,
  hasPosts,
}: {
  title: string;
  description: string;
  path: string;
  hasPosts: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
      types: { "application/rss+xml": [{ url: `${BLOG_PATH}/rss.xml`, title: BLOG_TITLE }] },
    },
    openGraph: { title, description, url: path, type: "website", locale: "tr_TR" },
    // Yazı yokken sayfa boş: dizine alınmaz, bağlantıları izlenir
    robots: hasPosts ? { index: true, follow: true } : { index: false, follow: true },
  };
}

// ─── Tüm yazılar ────────────────────────────────────────────────────────────

export async function blogIndexMetadata(page: number): Promise<Metadata> {
  const data = await getPosts({ page });
  if (page > 1 && data.posts.length === 0) notFound();
  return listingMetadata({
    title: page > 1 ? `${BLOG_TITLE} (Sayfa ${page})` : BLOG_TITLE,
    description: BLOG_INTRO,
    path: pagePath(BLOG_PATH, page),
    hasPosts: data.posts.length > 0,
  });
}

export async function BlogIndex({ page }: { page: number }) {
  const [data, categories] = await Promise.all([getPosts({ page }), getCategories()]);
  if (page > 1 && data.posts.length === 0) notFound();
  return (
    <BlogListing
      title="Taşınma rehberi"
      intro={BLOG_INTRO}
      crumbs={[
        { name: "Ana sayfa", href: "/" },
        { name: "Blog", href: BLOG_PATH },
      ]}
      basePath={BLOG_PATH}
      page={page}
      data={data}
      categories={categories}
    />
  );
}

// ─── Kategori ───────────────────────────────────────────────────────────────

async function loadCategory(slug: string) {
  const category = await getCategory(decodeURIComponent(slug));
  if (!category) notFound();
  return category;
}

const categoryIntro = (category: { name: string; description: string }) =>
  category.description || `${category.name} hakkında taşınma rehberleri ve uzman önerileri.`;

export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const category = await loadCategory(slug);
  const data = await getPosts({ page, categoryId: category.id });
  if (page > 1 && data.posts.length === 0) notFound();
  return listingMetadata({
    title: page > 1 ? `${category.name} (Sayfa ${page})` : category.name,
    description: categoryIntro(category),
    path: pagePath(categoryPath(category), page),
    hasPosts: data.posts.length > 0,
  });
}

export async function CategoryIndex({ slug, page }: { slug: string; page: number }) {
  const category = await loadCategory(slug);
  const [data, categories] = await Promise.all([getPosts({ page, categoryId: category.id }), getCategories()]);
  if (page > 1 && data.posts.length === 0) notFound();
  return (
    <BlogListing
      title={category.name}
      intro={categoryIntro(category)}
      crumbs={[
        { name: "Ana sayfa", href: "/" },
        { name: "Blog", href: BLOG_PATH },
        { name: category.name, href: categoryPath(category) },
      ]}
      basePath={categoryPath(category)}
      page={page}
      data={data}
      categories={categories}
      activeCategory={category.slug}
    />
  );
}
