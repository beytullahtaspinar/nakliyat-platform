import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs, type Crumb } from "@/components/local/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/blog/post-card";
import { HUB_PATH } from "@/lib/local-content";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  BLOG_PATH,
  type BlogCategory,
  type BlogPage,
  categoryPath,
  pagePath,
  postPath,
} from "@/lib/blog/wordpress";

/** Blog ana sayfası ve kategori sayfalarının ortak düzeni */
export function BlogListing({
  title,
  intro,
  crumbs,
  basePath,
  page,
  data,
  categories,
  activeCategory,
}: {
  title: string;
  intro: string;
  crumbs: Crumb[];
  /** Sayfalama bu adresin altında: /blog/sayfa/2, /blog/kategori/x/sayfa/2 */
  basePath: string;
  page: number;
  data: BlogPage;
  categories: BlogCategory[];
  activeCategory?: string;
}) {
  const url = `${SITE_URL}${pagePath(basePath, page)}`;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
        {page > 1 && <span className="text-zinc-600"> · Sayfa {page}</span>}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-700">{intro}</p>

      {categories.length > 0 && (
        <nav aria-label="Blog kategorileri" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <CategoryLink href={BLOG_PATH} active={!activeCategory}>
                Tüm yazılar
              </CategoryLink>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <CategoryLink href={categoryPath(c)} active={activeCategory === c.slug}>
                  {c.name}
                </CategoryLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {data.posts.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.posts.map((post, i) => (
              <li key={post.id} className="flex">
                <PostCard post={post} priority={i === 0} />
              </li>
            ))}
          </ul>
          <Pagination basePath={basePath} page={page} totalPages={data.totalPages} />
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Blog",
              "@id": `${url}#blog`,
              name: `${title} | ${SITE_NAME}`,
              url,
              inLanguage: "tr-TR",
              publisher: { "@id": `${SITE_URL}/#organization` },
              blogPost: data.posts.map((post) => ({
                "@type": "BlogPosting",
                headline: post.title,
                url: `${SITE_URL}${postPath(post)}`,
                datePublished: post.publishedAt,
                dateModified: post.modifiedAt,
              })),
            }}
          />
        </>
      ) : (
        <Card className="mt-8 p-6">
          <h2 className="text-xl font-semibold">Yazılar çok yakında burada</h2>
          <p className="mt-2 text-zinc-700">
            Taşınma rehberleri, fiyat bilgileri ve nakliyat firması seçerken dikkat edilecekler için yazılarımız
            hazırlanıyor. Bu sırada bölgendeki doğrulanmış firmalardan ücretsiz teklif alabilirsin.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/talep-olustur">Ücretsiz teklif al</ButtonLink>
            <ButtonLink href={HUB_PATH} variant="secondary">
              81 ilde nakliyat
            </ButtonLink>
          </div>
        </Card>
      )}
    </main>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium " +
        (active
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-zinc-300 text-zinc-800 hover:border-brand-700 hover:text-brand-800")
      }
    >
      {children}
    </Link>
  );
}

function Pagination({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
  );
  const linkClass = "inline-flex min-w-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium";
  return (
    <nav aria-label="Sayfalar" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <li>
            <Link href={pagePath(basePath, page - 1)} rel="prev" className={`${linkClass} border-zinc-300 hover:border-brand-700`}>
              ← Önceki
            </Link>
          </li>
        )}
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1] > 1 && <span aria-hidden>…</span>}
            <Link
              href={pagePath(basePath, p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Sayfa ${p}`}
              className={`${linkClass} ${p === page ? "border-brand-700 bg-brand-700 text-white" : "border-zinc-300 hover:border-brand-700"}`}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link href={pagePath(basePath, page + 1)} rel="next" className={`${linkClass} border-zinc-300 hover:border-brand-700`}>
              Sonraki →
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
