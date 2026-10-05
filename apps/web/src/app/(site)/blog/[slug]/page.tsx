import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs, type Crumb } from "@/components/local/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";
import { BLOG_PATH, type BlogPost, categoryPath, getPost, getPosts, postPath } from "@/lib/blog/wordpress";

// WordPress'te yazı güncellenince /api/blog/yenile önbelleği hemen bitirir; yoksa saatte bir yenilenir
export const revalidate = 3600;

// Yazılar derlemede üretilmez (WordPress'e bağlanılmaz); ilk ziyarette üretilip önbelleğe alınır
export const dynamicParams = true;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  const post = await getPost(decodeURIComponent(slug));
  if (!post) notFound();
  return post;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  const path = postPath(post);
  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "tr_TR",
      url: path,
      title: post.seoTitle,
      description: post.seoDescription,
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
      ...(post.author && { authors: [post.author.name] }),
      ...(post.categories[0] && { section: post.categories[0].name }),
      images: post.image
        ? [{ url: post.image.src, width: post.image.width, height: post.image.height, alt: post.image.alt }]
        : DEFAULT_OG_IMAGES,
    },
  };
}

/** schema.org BlogPosting: yazar, tarih ve görsel sayfada görünenle aynı */
function postJsonLd(post: BlogPost) {
  const url = `${SITE_URL}${postPath(post)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#yazi`,
    mainEntityOfPage: url,
    url,
    headline: post.title,
    description: post.seoDescription,
    datePublished: post.publishedAt,
    dateModified: post.modifiedAt,
    inLanguage: "tr-TR",
    wordCount: post.wordCount,
    ...(post.image && { image: { "@type": "ImageObject", url: post.image.src, width: post.image.width, height: post.image.height } }),
    ...(post.categories.length > 0 && { articleSection: post.categories.map((c) => c.name) }),
    author: post.author
      ? { "@type": "Person", name: post.author.name, ...(post.author.bio && { description: post.author.bio }) }
      : { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@type": "Blog", "@id": `${SITE_URL}${BLOG_PATH}#blog`, url: `${SITE_URL}${BLOG_PATH}` },
  };
}

/** WordPress içeriğinin görünümü: içerik düz HTML, biçim buradan gelir */
const PROSE = [
  "mt-8 text-[1.0625rem] leading-8 text-zinc-800",
  "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:text-zinc-900",
  "[&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-900",
  "[&_h4]:mt-6 [&_h4]:font-semibold [&_h4]:text-zinc-900",
  "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
  "[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a:hover]:text-brand-800",
  "[&_strong]:font-semibold [&_strong]:text-zinc-900",
  "[&_blockquote]:mt-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-400 [&_blockquote]:bg-accent-50 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:text-zinc-800",
  "[&_figure]:mt-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl",
  "[&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-zinc-600",
  "[&_hr]:my-10 [&_hr]:border-zinc-200",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
  "[&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-zinc-100 [&_pre]:p-4",
  "[&_.blog-table]:relative [&_.blog-table]:mt-6 [&_.blog-table]:overflow-x-auto",
  "[&_table]:w-full [&_table]:text-left [&_table]:text-[0.95rem] [&_table]:leading-6",
  "[&_th]:border-b-2 [&_th]:border-zinc-300 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:align-bottom",
  "[&_td]:border-b [&_td]:border-zinc-200 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top",
  "[&_details]:mt-4 [&_details]:rounded-xl [&_details]:border [&_details]:border-zinc-200 [&_details]:p-4",
  "[&_summary]:cursor-pointer [&_summary]:font-semibold [&_summary]:text-zinc-900",
].join(" ");

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await load(slug);
  // Adres, yazının kısa adından farklı yazıldıysa (ör. büyük harf) tek adrese kalıcı yönlenir
  if (decodeURIComponent(slug) !== decodeURIComponent(post.slug)) permanentRedirect(postPath(post));

  const category = post.categories[0];
  const related = category
    ? (await getPosts({ categoryId: category.id, perPage: 4 })).posts.filter((p) => p.id !== post.id).slice(0, 3)
    : [];
  const updated = new Date(post.modifiedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000;

  const crumbs: Crumb[] = [
    { name: "Ana sayfa", href: "/" },
    { name: "Blog", href: BLOG_PATH },
    ...(category ? [{ name: category.name, href: categoryPath(category) }] : []),
    { name: post.title, href: postPath(post) },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <JsonLd data={postJsonLd(post)} />
      <Breadcrumbs items={crumbs} />

      <article className="mt-6">
        <header>
          {category && (
            <Link
              href={categoryPath(category)}
              className="inline-block py-1 text-sm font-semibold uppercase tracking-wider text-accent-800 hover:underline"
            >
              {category.name}
            </Link>
          )}
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl">{post.title}</h1>
          <p className="mt-4 flex flex-wrap gap-x-2 text-sm text-zinc-600">
            {post.author && (
              <>
                <span>{post.author.name}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              {updated ? "Güncellendi: " : ""}
              <time dateTime={updated ? post.modifiedAt : post.publishedAt}>
                {formatDate(updated ? post.modifiedAt : post.publishedAt)}
              </time>
            </span>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} dk okuma</span>
          </p>
        </header>

        {post.image && (
          // WordPress görselin boyutlarını (srcset) zaten üretiyor; sunucuda yeniden işlenmez
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image.src}
            srcSet={post.image.srcSet}
            sizes="(min-width: 768px) 720px, 100vw"
            width={post.image.width}
            height={post.image.height}
            alt={post.image.alt}
            fetchPriority="high"
            className="mt-8 aspect-[16/9] w-full rounded-2xl bg-zinc-100 object-cover"
          />
        )}

        {post.headings.length >= 3 && (
          <nav aria-label="İçindekiler" className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-sm font-semibold text-zinc-900">İçindekiler</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              {post.headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="inline-block py-0.5 hover:text-brand-700 hover:underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* İçerik renderContent ile temizlendi: yalnızca izin verilen etiket ve nitelikler kalır */}
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: post.html }} />

        {post.author?.bio && (
          <aside aria-label="Yazar hakkında" className="mt-12 rounded-xl border border-zinc-200 p-5">
            <p className="font-semibold text-zinc-900">{post.author.name}</p>
            <p className="mt-1 text-sm text-zinc-700">{post.author.bio}</p>
          </aside>
        )}
      </article>

      <Card className="mt-12 bg-brand-50 p-6">
        <h2 className="text-xl font-semibold text-zinc-900">Taşınmayı planlıyor musun?</h2>
        <p className="mt-2 text-zinc-700">
          Taşınma bilgilerini bir kez gir; K3 belgeli, doğrulanmış nakliyat firmalarından ücretsiz teklif al ve
          karşılaştır.
        </p>
        <ButtonLink href="/talep-olustur" size="lg" className="mt-4">
          Ücretsiz teklif al
        </ButtonLink>
      </Card>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="ilgili-yazilar">
          <h2 id="ilgili-yazilar" className="text-2xl font-semibold">
            İlgili yazılar
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.id} className="flex">
                <PostCard post={p} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
