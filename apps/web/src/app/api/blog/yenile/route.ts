import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { BLOG_CACHE_TAG, BLOG_PATH } from "@/lib/blog/wordpress";

/**
 * WordPress yazı yayınlayınca/güncelleyince/silince bu adresi çağırır (docs/blog-wordpress.md, mu-plugin).
 * Blog önbelleği hemen biter: sonraki ziyaretçi yeni içeriği görür.
 * Anahtar: web uygulamasında BLOG_REVALIDATE_SECRET, WordPress'te wp-config.php içinde aynı değer.
 */
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = process.env.BLOG_REVALIDATE_SECRET ?? "";
  if (secret.length < 16) return Response.json({ message: "Blog yenileme kapalı." }, { status: 404 });

  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Sabit uzunlukta özetler karşılaştırılır: süre farkından anahtar tahmin edilemesin
  if (!timingSafeEqual(digest(given), digest(secret))) {
    return Response.json({ message: "Geçersiz anahtar." }, { status: 401 });
  }

  // expire: 0 → eski sayfa gösterilmez, ilk ziyaret yeni içerikle üretilir
  revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
  // Derlemede üretilen sayfalar WordPress adresi o sırada yoksa etiket taşımaz: adresleriyle de yenilenir.
  // Diğer blog sayfaları ilk ziyarette üretildiği için etiketlidir.
  for (const path of [BLOG_PATH, `${BLOG_PATH}/rss.xml`, "/sitemap.xml"]) revalidatePath(path);
  return Response.json({ yenilendi: true });
}
