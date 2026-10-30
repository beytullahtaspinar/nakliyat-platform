import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocalPage, type LocalPage } from "@nakliyat/locations";
import { estimatePrice, type PriceEstimate } from "@nakliyat/pricing";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { CoverImage } from "@/components/local/cover-image";
import { Faq } from "@/components/local/faq";
import { LinkGrid } from "@/components/local/link-grid";
import { LocalCompanies } from "@/components/local/local-companies";
import { LatestReviews } from "@/components/reviews/latest-reviews";
import { Stars } from "@/components/reviews/stars";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import {
  breadcrumbs,
  faq,
  intro,
  priceFactors,
  relatedLinks,
  requestHref,
} from "@/lib/local-content";
import {
  getIndexableLocalPages,
  currentYear,
  isIndexable,
  localPageDescription,
  localPageMetaTitle,
  localPageTitle,
} from "@/lib/local-seo";
import { getLocalCompanies } from "@/lib/local-companies";
import { getLocalPageContent } from "@/lib/local-page-content";
import { CITY_RATING_SCHEMA_MIN, getCityRating, getLocalReviews, type CityRating } from "@/lib/latest-reviews";
import { getLocalStats } from "@/lib/local-stats";
import { formatDate } from "@/lib/format";
import { DEFAULT_INPUT, calculatorHref, formatTry } from "@/lib/pricing";
import { loadPricingModel } from "@/lib/pricing-model";
import { HOME_TYPES } from "@/lib/request-options";
import { BLOG_PROSE } from "@/lib/blog/prose";
import { formatRating } from "@/lib/reviews";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";
import type { LatestReview } from "@/lib/api";

// Dizine açık sayfalar derlemede üretilir; diğerleri ilk ziyarette üretilip önbelleğe alınır.
export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return getIndexableLocalPages().map((page) => ({ slug: page.slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function loadPage(params: Props["params"]): Promise<LocalPage> {
  const { slug } = await params;
  const page = resolveLocalPage(slug);
  if (!page) notFound();
  return page;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadPage(params);
  const custom = await getLocalPageContent(page.slug);
  const title = custom?.seoTitle ?? localPageMetaTitle(page);
  const description = custom?.seoDescription ?? localPageDescription(page);
  return {
    title,
    description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { title, description, url: `/${page.slug}`, type: "website", locale: "tr_TR", images: DEFAULT_OG_IMAGES },
    robots: isIndexable(page) ? { index: true, follow: true } : { index: false, follow: true },
  };
}

function serviceJsonLd(page: LocalPage) {
  const area =
    page.kind === "route"
      ? [page.from, page.to].map((c) => ({ "@type": "City", name: c.name }))
      : page.kind === "district"
        ? {
            "@type": "AdministrativeArea",
            name: page.district.name,
            containedInPlace: { "@type": "City", name: page.city.name },
          }
        : { "@type": "City", name: page.city.name };
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: localPageTitle(page),
    serviceType: page.kind === "route" ? "Şehirler arası evden eve nakliyat" : "Evden eve nakliyat",
    description: localPageDescription(page),
    url: `${SITE_URL}/${page.slug}`,
    areaServed: area,
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

/**
 * İl sayfasının puanı: platform üzerinden o ilde yapılan taşımaların gerçek puanları, sayfada da görünür.
 * Google yıldızları Service için göstermez; Product için gösterebilir. Az değerlendirmeyle verilmez.
 */
function ratingJsonLd(page: LocalPage, rating: CityRating, reviews: LatestReview[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localPageTitle(page),
    description: localPageDescription(page),
    url: `${SITE_URL}/${page.slug}`,
    brand: { "@id": `${SITE_URL}/#organization` },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: rating.average,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      datePublished: r.createdAt.slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.comment && { reviewBody: r.comment }),
    })),
  };
}

/** Ev tipine göre tahmini fiyatlar: hesaplayıcının varsayılan girdileri (2. kat, asansörlü, ortalama eşya) */
async function priceTable(page: LocalPage) {
  const { settings, calibration, updatedAt } = await loadPricingModel();
  const distanceKm = page.kind === "route" ? page.distanceKm : undefined;
  const rows: { label: string; estimate: PriceEstimate }[] = HOME_TYPES.filter((t) => t.value !== "OFFICE").map((t) => ({
    label: t.label,
    estimate: estimatePrice({ ...DEFAULT_INPUT, homeType: t.value, distanceKm }, settings, calibration),
  }));
  return { rows, updatedAt };
}

export default async function LocalLandingPage({ params }: Props) {
  const page = await loadPage(params);
  const [custom, stats, companies, reviews, prices, rating] = await Promise.all([
    getLocalPageContent(page.slug),
    getLocalStats(page),
    getLocalCompanies(page),
    getLocalReviews(page),
    priceTable(page),
    page.kind === "city" ? getCityRating(page.city.code) : null,
  ]);
  const year = currentYear();
  const source = prices.rows[0]?.estimate;
  // Yönetimden yazılan metin otomatik metnin yerine geçer; boş alanlar otomatik kalır
  const introParagraphs = custom?.intro ? custom.intro.split(/\n\s*\n/) : [intro(page)];
  const faqItems = custom?.faq.length ? custom.faq : faq(page);
  // İlçe sayfasında da il geneli: firmalar il bazında hizmet verir
  const region = page.kind === "route" ? `${page.from.name} - ${page.to.name} arasında` : `${page.city.name} ilinde`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs items={breadcrumbs(page)} />

      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {custom?.heading ?? localPageTitle(page)}
      </h1>
      {rating && page.kind === "city" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-700">
          <Stars value={rating.average} />
          <span>
            <strong className="font-semibold">{formatRating(rating.average)}</strong> / 5 ·{" "}
            {rating.count.toLocaleString("tr-TR")} değerlendirme
          </span>
          <span className="text-sm text-zinc-600">({page.city.name} taşımalarında firmalara verilen puanlar)</span>
        </p>
      )}
      {introParagraphs.map((text) => (
        <p key={text} className="mt-4 text-lg text-zinc-700">
          {text}
        </p>
      ))}

      <ButtonLink href={requestHref(page)} size="lg" className="mt-6">
        Ücretsiz teklif al
      </ButtonLink>

      {custom?.cover && <CoverImage image={custom.cover} />}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">
          {localPageTitle(page)} fiyatları {year}
        </h2>
        <p className="mt-2 text-zinc-600">
          {page.kind === "route" ? `${page.distanceKm} km şehirler arası taşıma için` : "Şehir içi taşıma için"} ev tipine göre
          tahmini fiyat aralığı: ortalama eşya, iki adreste de 2. kat ve asansörlü bina, paketleme ve montaj hariç.
          {source?.source === "platform"
            ? ` Platformdaki ${source.samples} anlaşmanın fiyatlarıyla ayarlandı.`
            : " Tahmindir; kesin fiyatı firmalar eşyanızı görerek verir."}
          {prices.updatedAt && ` Katsayılar ${formatDate(prices.updatedAt)} tarihinde güncellendi.`}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-2">Ev tipi</th>
                <th scope="col" className="py-2">Tahmini fiyat</th>
              </tr>
            </thead>
            <tbody>
              {prices.rows.map((r) => (
                <tr key={r.label} className="border-t border-zinc-200">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2">
                    {formatTry(r.estimate.minTry)} - {formatTry(r.estimate.maxTry)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {stats && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Bölgedeki güncel teklif verileri</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {stats.verifiedCompanyCount} doğrulanmış firma, son 90 günde {stats.quoteCount} teklif.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Ev tipi</th>
                <th className="py-2">Teklif aralığı</th>
                <th className="py-2">Teklif sayısı</th>
              </tr>
            </thead>
            <tbody>
              {stats.priceRanges.map((r) => (
                <tr key={r.homeType} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2">{r.homeType}</td>
                  <td className="py-2">
                    {r.minTry.toLocaleString("tr-TR")} - {r.maxTry.toLocaleString("tr-TR")} TL
                  </td>
                  <td className="py-2">{r.sampleSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <LocalCompanies
        title={`${region} hizmet veren doğrulanmış firmalar`}
        items={companies.items}
        total={companies.total}
      />

      {reviews.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">
            {page.kind === "route" ? `${page.from.name} - ${page.to.name} taşınan müşterilerin yorumları` : `${page.city.name} taşımalarından son yorumlar`}
          </h2>
          <p className="mt-2 text-zinc-600">
            Firmayla platform üzerinden anlaşıp taşınması tamamlanan müşterilerin yorumları.
          </p>
          <LatestReviews reviews={reviews} wide={false} className="mt-4" />
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Nasıl çalışır?</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>Nereden, nereye, ev tipi, kat ve tarih bilgilerini girin.</li>
          <li>Bölgede hizmet veren doğrulanmış firmalar size teklif göndersin.</li>
          <li>Fiyatı, hizmet kapsamını, puanı ve yorumları karşılaştırıp seçin.</li>
          <li>Taşınma sonrası deneyiminizi puanlayın, sonraki müşterilere yol gösterin.</li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Fiyatı etkileyen etkenler</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          {priceFactors(page).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link
          href={page.kind === "route" ? calculatorHref(page.from.code, page.to.code) : calculatorHref(page.city.code, page.city.code)}
          className="mt-4 inline-flex items-center gap-1.5 py-1 font-semibold text-brand-700 hover:underline"
        >
          Tahmini fiyatı hesapla <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </section>

      {custom?.html && (
        // İçerik renderContent ile temizlendi: yalnızca izin verilen etiket ve nitelikler kalır
        <section className={BLOG_PROSE} dangerouslySetInnerHTML={{ __html: custom.html }} />
      )}

      <Faq items={faqItems} />

      {relatedLinks(page).map((group) => (
        <LinkGrid key={group.title} title={group.title} links={group.links} />
      ))}

      <JsonLd data={serviceJsonLd(page)} />
      {rating && rating.count >= CITY_RATING_SCHEMA_MIN && <JsonLd data={ratingJsonLd(page, rating, reviews)} />}
    </main>
  );
}
