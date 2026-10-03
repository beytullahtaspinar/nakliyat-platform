import { API_BASE } from "@/lib/api";

/**
 * Firma logo ve fotoğrafları sitenin kendi adresinden: /medya/firmalar/<firmaId>/<dosya>.webp.
 * Dosya API'den (R2 ya da sunucu diski) aktarılır. Görseller ayrı alan adına bağlantı açmadan yüklenir
 * ve Google'da sitenin görseli olarak görünür. Önbellek başlığını API verir (tarayıcıda bir yıl).
 */
export async function GET(_request: Request, { params }: RouteContext<"/medya/firmalar/[companyId]/[file]">) {
  const { companyId, file } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(companyId) || !/^[a-f0-9]{32}\.(webp|jpg)$/.test(file)) {
    return new Response("Bulunamadı", { status: 404 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/public-media/firmalar/${companyId}/${file}`, { cache: "no-store" });
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
