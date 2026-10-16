import { API_BASE } from "@/lib/api";

/**
 * Blog görselleri sitenin kendi adresinden: /medya/blog/<dosya>.webp. Dosya API'den (R2 ya da sunucu diski)
 * aktarılır; görseller ayrı alan adına bağlantı açmadan yüklenir ve Google'da sitenin görseli olarak görünür.
 * Önbellek başlığını API verir (dosya adı rastgele, içerik değişmez: bir yıl).
 */
export async function GET(_request: Request, { params }: RouteContext<"/medya/blog/[file]">) {
  const { file } = await params;
  if (!/^[a-f0-9]{32}\.(webp|jpg)$/.test(file)) return new Response("Bulunamadı", { status: 404 });
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/public-media/blog/${file}`, { cache: "no-store" });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.status === 404 ? "Bulunamadı" : null, {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
  for (const name of ["content-type", "content-length", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
