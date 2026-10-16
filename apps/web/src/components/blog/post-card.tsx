import Link from "next/link";
import { preload } from "react-dom";
import { formatDate } from "@/lib/format";
import { type BlogPostSummary, postPath } from "@/lib/blog/api";

/** Liste kartı. `priority`: ilk ekranda görünen kartın görseli hemen yüklenir (LCP). */
export function PostCard({ post, priority = false, headingLevel = 2 }: { post: BlogPostSummary; priority?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const category = post.category;
  const srcSet = post.cover && `${post.cover.thumb.src} ${post.cover.thumb.width}w, ${post.cover.src} ${post.cover.width}w`;
  const sizes = "(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw";
  // İlk kartın görseli <head>'de ön yüklenir: tarayıcı onu sayfayı ayrıştırmayı beklemeden ister (LCP)
  if (priority && post.cover && srcSet) {
    preload(post.cover.thumb.src, { as: "image", imageSrcSet: srcSet, imageSizes: sizes, fetchPriority: "high" });
  }
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-[var(--shadow-card)]">
      {post.cover && (
        // Görsel yüklenirken iki boyutta üretildi (800 ve 1600 px); sunucuda yeniden işlenmez
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover.thumb.src}
          srcSet={srcSet ?? undefined}
          sizes={sizes}
          width={post.cover.thumb.width}
          height={post.cover.thumb.height}
          alt=""
          loading={priority ? undefined : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? undefined : "async"}
          className="aspect-[16/9] w-full bg-zinc-100 object-cover"
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        {category && <p className="text-xs font-semibold uppercase tracking-wider text-accent-800">{category.name}</p>}
        <Heading className="mt-2 text-lg font-semibold leading-snug text-zinc-900">
          {/* Kartın tamamı tıklanır: bağlantı başlıkta, ::after kartı kaplar */}
          <Link href={postPath(post)} className="after:absolute after:inset-0 group-hover:text-brand-700">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{post.excerpt}</p>}
        <p className="mt-auto pt-4 text-xs text-zinc-600">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </p>
      </div>
    </article>
  );
}
