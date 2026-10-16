import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/api";
import { BLOG_PATH, SLUG_PATTERN } from "./rules";

const POST_PATH = new RegExp(`^${BLOG_PATH}/([^/]+)$`);

/**
 * Adresi değişen yazının eski adresi yeni adrese kalıcı (301) yönlenir.
 *
 * Yönlendirme sayfada değil burada (proxy) yapılır: önbellekteki yazı sayfası yönlendirmeye dönüşünce
 * Next.js 16 Location başlığını iki kez yazıyor ve tarayıcı 404 alıyor. API'ye ulaşılamazsa istek sayfaya geçer.
 */
export async function blogRedirect(request: NextRequest): Promise<NextResponse | null> {
  const slug = request.nextUrl.pathname.match(POST_PATH)?.[1];
  if (!slug || slug.length > 200 || !SLUG_PATTERN.test(slug)) return null;
  try {
    const res = await fetch(`${API_BASE}/blog/redirects/${slug}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const target = ((await res.json()) as { slug?: unknown }).slug;
    if (typeof target !== "string" || !SLUG_PATTERN.test(target) || target === slug) return null;
    const url = request.nextUrl.clone();
    url.pathname = `${BLOG_PATH}/${target}`;
    return NextResponse.redirect(url, 301);
  } catch {
    return null;
  }
}
