import { BLOG_PATH, getPosts, postPath } from "@/lib/blog/wordpress";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Yazı yayınlanınca /api/blog/yenile önbelleği bitirir
export const revalidate = 3600;

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]!);

/** RSS: haber okuyucular ve yapay zekâ tarayıcıları yeni yazıları buradan izler */
export async function GET() {
  const { posts } = await getPosts({ perPage: 30 });
  const items = posts
    .map((post) => {
      const url = `${SITE_URL}${postPath(post)}`;
      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`,
        ...post.categories.map((c) => `<category>${escapeXml(c.name)}</category>`),
        `<description>${escapeXml(post.excerpt)}</description>`,
        "</item>",
      ].join("");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(`Taşınma rehberi | ${SITE_NAME}`)}</title>
<link>${SITE_URL}${BLOG_PATH}</link>
<atom:link href="${SITE_URL}${BLOG_PATH}/rss.xml" rel="self" type="application/rss+xml"/>
<description>Evden eve nakliyat fiyatları, taşınma hazırlığı ve nakliyat firması seçimi üzerine rehberler.</description>
<language>tr-TR</language>
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
