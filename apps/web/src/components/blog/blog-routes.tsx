import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogListing } from "@/components/blog/blog-listing";
import { BLOG_PATH, authorPath, categoryPath, getAuthor, getCategories, getCategory, getPosts, pagePath } from "@/lib/blog/api";
import { JsonLd } from "@/components/json-ld";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";

/**
 * Blog liste sayfaları: /blog, /blog/sayfa/[n], /blog/kategori/[slug], /blog/kategori/[slug]/sayfa/[n].
 * Yazar sayfaları: /blog/yazar/[slug], /blog/yazar/[slug]/sayfa/[n].
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

export function listingMetadata({
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
    openGraph: { title, description, url: path, type: "website", locale: "tr_TR", images: DEFAULT_OG_IMAGES },
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
  const category = await getCategory(slug);
  if (!category) notFound();
  return category;
}

const categoryIntro = (category: { name: string; description: string | null }) =>
  category.description || `${category.name} hakkında taşınma rehberleri ve uzman önerileri.`;

export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const category = await loadCategory(slug);
  const data = await getPosts({ page, category: category.slug });
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
  const [data, categories] = await Promise.all([getPosts({ page, category: category.slug }), getCategories()]);
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

// ─── Yazar ──────────────────────────────────────────────────────

async function loadAuthor(slug: string) {
  const author = await getAuthor(slug);
  if (!author) notFound();
  return author;
}

const authorIntro = (author: { name: string; jobTitle: string | null }) =>
  author.jobTitle ? `${author.name}, ${author.jobTitle}. Yazdığı taşınma rehberleri.` : `${author.name} tarafından yazılan taşınma rehberleri.`;

export async function authorMetadata(slug: string, page: number): Promise<Metadata> {
  const author = await loadAuthor(slug);
  const data = await getPosts({ page, author: author.slug });
  if (page > 1 && data.posts.length === 0) notFound();
  const metadata = listingMetadata({
    title: page > 1 ? `${author.name} (Sayfa ${page})` : author.name,
    description: (author.bio || authorIntro(author)).slice(0, 300),
    path: pagePath(authorPath(author), page),
    hasPosts: data.posts.length > 0,
  });
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "profile" } };
}

export async function AuthorIndex({ slug, page }: { slug: string; page: number }) {
  const author = await loadAuthor(slug);
  const [data, categories] = await Promise.all([getPosts({ page, author: author.slug }), getCategories()]);
  if (page > 1 && data.posts.length === 0) notFound();
  const url = `${SITE_URL}${authorPath(author)}`;
  return (
    <BlogListing
      title={author.name}
      intro={author.jobTitle ?? "Yazar"}
      crumbs={[
        { name: "Ana sayfa", href: "/" },
        { name: "Blog", href: BLOG_PATH },
        { name: author.name, href: authorPath(author) },
      ]}
      basePath={authorPath(author)}
      page={page}
      data={data}
      categories={categories}
      before={
        <>
          {/* Yazar profili (E-E-A-T): kim yazıyor, hangi deneyimle */}
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              url,
              mainEntity: {
                "@type": "Person",
                "@id": `${url}#kisi`,
                name: author.name,
                url,
                ...(author.jobTitle && { jobTitle: author.jobTitle }),
                ...(author.bio && { description: author.bio }),
                ...(author.photo && { image: `${SITE_URL}${author.photo.src}` }),
                ...(author.sameAs.length > 0 && { sameAs: author.sameAs }),
                worksFor: { "@id": `${SITE_URL}/#organization` },
              },
            }}
          />
          {(author.bio || author.photo || author.sameAs.length > 0) && (
            <div className="mt-6 flex max-w-3xl gap-5">
              {author.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.photo.thumb.src}
                  width={96}
                  height={96}
                  alt=""
                  className="size-24 shrink-0 rounded-full bg-zinc-100 object-cover"
                />
              )}
              <div>
                {author.bio && <p className="whitespace-pre-line text-zinc-700">{author.bio}</p>}
                {author.sameAs.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {author.sameAs.map((href) => (
                      <li key={href}>
                        <a href={href} rel="noopener noreferrer me" className="inline-block py-1 font-medium text-brand-700 hover:underline">
                          {profileLabel(href)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      }
    />
  );
}

/** Profil bağlantısının görünen adı: alan adından (linkedin.com → LinkedIn) */
function profileLabel(href: string) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  const known: Record<string, string> = {
    "linkedin.com": "LinkedIn",
    "x.com": "X",
    "twitter.com": "X",
    "instagram.com": "Instagram",
    "youtube.com": "YouTube",
    "facebook.com": "Facebook",
  };
  return known[host] ?? host;
}
