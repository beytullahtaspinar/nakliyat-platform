import Link from "next/link";
import type { PublicCompanyListItem } from "@/lib/api";
import { companyPath, formatRating } from "@/lib/reviews";

/** İl sayfasında bölgede hizmet veren doğrulanmış firmalar: firma sayfalarına iç bağlantı */
export function LocalCompanies({
  title,
  items,
  total,
}: {
  title: string;
  items: PublicCompanyListItem[];
  total: number;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-zinc-600">
        Belgeleri ekibimizce kontrol edilmiş firmalar. Talep oluşturduğunda bu firmalar sana teklif gönderebilir.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={companyPath(c)}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-brand-300 hover:bg-brand-50"
            >
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 192 px WebP logo, kalıcı adres
                <img
                  src={c.logoUrl}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain p-0.5"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg font-semibold text-brand-800"
                >
                  {c.displayName.slice(0, 1).toLocaleUpperCase("tr-TR")}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-zinc-900">{c.displayName}</span>
                <span className="block text-sm text-zinc-600">
                  {c.cityName} merkezli
                  {c.ratingCount > 0 && ` · ★ ${formatRating(c.ratingAverage)} (${c.ratingCount} yorum)`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > items.length && (
        <p className="mt-3 text-sm text-zinc-600">
          Bu bölgede {total} doğrulanmış firma var; talep oluşturduğunda hepsi teklif verebilir.
        </p>
      )}
    </section>
  );
}
