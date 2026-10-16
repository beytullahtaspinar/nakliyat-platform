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
import { BLOG_PROSE as PROSE } from "@/lib/blog/prose";
import { BLOG_PATH, type BlogPost, authorPath, categoryPath, getPost, getPosts, postPath } from "@/lib/blog/api";

// Yönetimde yazı kaydedilince önbellek hemen biter; yoksa en geç 15 dakikada bir yenilenir
export const revalidate = 900;

// Yazılar derlemede üretilmez; ilk ziyarette üretilip önbelleğe alınır
export const dynamicParams = true;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

/** Yazı. Eski adresler normalde proxy'de yönlenir (lib/blog/redirect.ts); buradaki yalnızca yedek. */
const load = cache(async (slug: string): Promise<BlogPost> => {
  const post = await getPost(decodeURIComponent(slug));
  if (!post) notFound();
  if ("redirect" in post) permanentRedirect(`${BLOG_PATH}/${post.redirect}`);
  return post;
});

const absolute = (src: string) => (src.startsWith("/") ? `${SITE_URL}${src}` : src);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  const path = postPath(post);
  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: { canonical: path },
    ...(post.noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      type: "article",
      locale: "tr_TR",
      url: path,
      title: post.seoTitle,
      description: post.seoDescription,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(post.author && { authors: [`${SITE_URL}${authorPath(post.author)}`] }),
      ...(post.category && { section: post.category.name }),
      images: post.cover
        ? [{ url: post.cover.src, width: post.cover.width, height: post.cover.height, alt: post.cover.alt }]
        : DEFAULT_OG_IMAGES,
    },
  };
}

/** schema.org BlogPosting (+ sık sorulan sorular varsa FAQPage): yazar, tarih ve görsel sayfada görünenle aynı */
function postJsonLd(post: BlogPost) {
  const url = `${SITE_URL}${postPath(post)}`;
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#yazi`,
    mainEntityOfPage: url,
    url,
    headline: post.title,
    description: post.seoDescription,
    ...(post.summary && { abstract: post.summary }),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: "tr-TR",
    wordCount: post.wordCount,
    ...(post.cover && {
      image: { "@type": "ImageObject", url: absolute(post.cover.src), width: post.cover.width, height: post.cover.height },
    }),
    ...(post.category && { articleSection: post.category.name }),
    author: post.author
      ? {
          "@type": "Person",
          "@id": `${SITE_URL}${authorPath(post.author)}#kisi`,
          name: post.author.name,
          url: `${SITE_URL}${authorPath(post.author)}`,
          ...(post.author.jobTitle && { jobTitle: post.author.jobTitle }),
          ...(post.author.photo && { image: absolute(post.author.photo.src) }),
          ...(post.author.sameAs.length > 0 && { sameAs: post.author.sameAs }),
        }
      : { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@type": "Blog", "@id": `${SITE_URL}${BLOG_PATH}#blog`, url: `${SITE_URL}${BLOG_PATH}` },
  };
  if (post.faq.length === 0) return [article];
  return [
    article,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${url}#sss`,
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await load(slug);
  // Adres, yazının kısa adından farklı yazıldıysa (ör. büyük harf) tek adrese kalıcı yönlenir
  if (decodeURIComponent(slug) !== post.slug) permanentRedirect(postPath(post));

  const { category, author } = post;
  // İlgili yazılar: aynı kategoriden, yoksa en yeniler
  const related = (await getPosts({ category: category?.slug, perPage: 4 })).posts.filter((p) => p.id !== post.id).slice(0, 3);
  const updated = new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000;

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
            {author && (
              <>
                <Link href={authorPath(author)} className="font-medium text-zinc-800 hover:text-brand-700 hover:underline">
                  {author.name}
                </Link>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              Yayın: <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </span>
            {updated && (
              <>
                <span aria-hidden>·</span>
                <span>
                  Güncellendi: <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} dk okuma</span>
          </p>
        </header>

        {post.cover && (
          // Görsel yüklenirken iki boyutta üretildi (800 ve 1600 px); sunucuda yeniden işlenmez
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover.src}
            srcSet={`${post.cover.thumb.src} ${post.cover.thumb.width}w, ${post.cover.src} ${post.cover.width}w`}
            sizes="(min-width: 768px) 720px, 100vw"
            width={post.cover.width}
            height={post.cover.height}
            alt={post.cover.alt}
            fetchPriority="high"
            className="mt-8 aspect-[16/9] w-full rounded-2xl bg-zinc-100 object-cover"
          />
        )}

        {post.summary && (
          // Sorunun net cevabı en başta: okur ve yapay zekâ yanıt motorları buradan alıntılar (GEO)
          <section aria-labelledby="kisaca" className="mt-8 rounded-xl border-l-4 border-accent-500 bg-accent-50 p-5">
            <h2 id="kisaca" className="text-sm font-semibold uppercase tracking-wider text-accent-800">
              Kısaca
            </h2>
            <p className="mt-2 whitespace-pre-line text-[1.0625rem] leading-7 text-zinc-900">{post.summary}</p>
          </section>
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
              {post.faq.length > 0 && (
                <li>
                  <a href="#sik-sorulan-sorular" className="inline-block py-0.5 hover:text-brand-700 hover:underline">
                    Sık sorulan sorular
                  </a>
                </li>
              )}
            </ol>
          </nav>
        )}

        {/* İçerik renderContent ile temizlendi: yalnızca izin verilen etiket ve nitelikler kalır */}
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: post.html }} />

        {post.faq.length > 0 && (
          <section aria-labelledby="sik-sorulan-sorular" className="mt-12">
            <h2 id="sik-sorulan-sorular" className="scroll-mt-24 text-2xl font-semibold text-zinc-900">
              Sık sorulan sorular
            </h2>
            <dl className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
              {post.faq.map((f) => (
                <div key={f.question} className="p-5">
                  <dt className="font-semibold text-zinc-900">{f.question}</dt>
                  <dd className="mt-2 whitespace-pre-line text-zinc-700">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {author && (
          <aside aria-label="Yazar hakkında" className="mt-12 flex gap-4 rounded-xl border border-zinc-200 p-5">
            {author.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.photo.thumb.src}
                width={64}
                height={64}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-16 shrink-0 rounded-full bg-zinc-100 object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-zinc-900">
                <Link href={authorPath(author)} className="hover:text-brand-700 hover:underline">
                  {author.name}
                </Link>
              </p>
              {author.jobTitle && <p className="text-sm text-zinc-600">{author.jobTitle}</p>}
              {author.bio && <p className="mt-2 line-clamp-4 text-sm text-zinc-700">{author.bio}</p>}
            </div>
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
