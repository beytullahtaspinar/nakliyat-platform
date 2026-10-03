import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { citySlug, getCityByCode } from "@nakliyat/locations";
import { BadgePill, CompanyBadges } from "@/components/company-badges";
import { CompanyGallery } from "@/components/company-gallery";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs, type Crumb } from "@/components/local/breadcrumbs";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewCard } from "@/components/reviews/review-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { ApiError, apiFetch, type Paginated, type PublicCompanyProfile, type PublicReview } from "@/lib/api";
import { BADGE_ORDER, BADGES } from "@/lib/badges";
import { HUB_PATH } from "@/lib/local-content";
import { COMPANY_CACHE_TAG, companyIdFromSlug, companyPath, formatRating } from "@/lib/reviews";
import { serviceLabel } from "@/lib/showcase";
import { SITE_URL } from "@/lib/site";

// Sayfa bir saat önbellekte kalır; yorum eklenince/gizlenince sunucu eylemi önbelleği hemen bitirir (updateTag).
export const revalidate = 3600;

// Derlemede sayfa üretilmez (API'ye bağlanılmaz); ilk ziyarette üretilip önbelleğe alınır.
export const dynamicParams = true;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Sayfada gösterilen en yeni yorum sayısı */
const REVIEW_LIMIT = 50;

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  const id = companyIdFromSlug(slug);
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  try {
    const [company, reviews] = await Promise.all([
      apiFetch<PublicCompanyProfile>(`/companies/${id}`, { revalidate, tags: [COMPANY_CACHE_TAG] }),
      apiFetch<Paginated<PublicReview>>(`/companies/${id}/reviews?limit=${REVIEW_LIMIT}`, {
        revalidate,
        tags: [COMPANY_CACHE_TAG],
      }),
    ]);
    return { company, reviews };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

const yearOf = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { year: "numeric", timeZone: "Europe/Istanbul" });

/** Firma tanıtımının ilk cümleleri (arama sonucu açıklaması için) */
function excerpt(text: string, max = 150) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : max).replace(/[,.;:]$/, "")}…`;
}

function description(company: PublicCompanyProfile) {
  if (company.description && company.description.trim().length >= 80) {
    const rating = company.ratingCount > 0 ? ` ★ ${formatRating(company.ratingAverage)} (${company.ratingCount} yorum).` : "";
    return `${excerpt(company.description)}${rating}`;
  }
  const rating =
    company.ratingCount > 0
      ? `${company.ratingCount} müşteri yorumu, ortalama ${formatRating(company.ratingAverage)}/5 puan.`
      : "Henüz müşteri yorumu yok.";
  return `${company.displayName}: ${company.cityName ?? "Türkiye"} merkezli, belgeleri doğrulanmış evden eve nakliyat firması. ${rating} Ücretsiz teklif al, fiyatları karşılaştır.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { company } = await load((await params).slug);
  const title =
    company.ratingCount > 0
      ? `${company.displayName} yorumları ve puanı`
      : `${company.displayName}: ${company.cityName ?? "Türkiye"} evden eve nakliyat`;
  const path = companyPath(company);
  const image = company.photos[0]?.url ?? company.logoUrl;
  return {
    title,
    description: description(company),
    alternates: { canonical: path },
    openGraph: {
      title,
      description: description(company),
      url: path,
      type: "website",
      locale: "tr_TR",
      ...(image && { images: [{ url: image }] }),
    },
    // Yorumu da tanıtımı da olmayan firma sayfası ince içerik: bağlantıları izlenir ama dizine alınmaz.
    // Kural API'de (showcase-rules.ts): yorum ya da en az 300 karakter tanıtım + 2 fotoğraf.
    robots: company.indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

/** schema.org MovingCompany: puan yalnızca yayındaki gerçek yorumlardan, yorumlar sayfada görünenlerle aynı */
const absolute = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

function companyJsonLd(company: PublicCompanyProfile, reviews: PublicReview[]) {
  const url = `${SITE_URL}${companyPath(company)}`;
  const images = [...company.photos.map((p) => absolute(p.url)), ...(company.logoUrl ? [absolute(company.logoUrl)] : [])];
  return {
    "@context": "https://schema.org",
    "@type": "MovingCompany",
    "@id": `${url}#firma`,
    name: company.displayName,
    url,
    ...(company.description && { description: company.description }),
    ...(company.logoUrl && { logo: absolute(company.logoUrl) }),
    ...(images.length > 0 && { image: images }),
    address: { "@type": "PostalAddress", addressLocality: company.cityName, addressCountry: "TR" },
    areaServed: company.serviceCities.map((c) => ({ "@type": "City", name: c.name })),
    ...(company.foundedYear && { foundingDate: String(company.foundedYear) }),
    ...(company.staffSize && { numberOfEmployees: { "@type": "QuantitativeValue", value: company.staffSize } }),
    ...(company.services.length > 0 && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Hizmetler",
        itemListElement: company.services.map((code) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: serviceLabel(code) },
        })),
      },
    }),
    ...(company.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(company.ratingAverage),
        reviewCount: company.ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.slice(0, 10).map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.authorName },
        datePublished: r.createdAt.slice(0, 10),
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        ...(r.comment && { reviewBody: r.comment }),
      })),
    }),
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const { company, reviews } = await load(slug);
  // Firma adı değiştiyse eski adres yenisine kalıcı yönlenir
  if (`/firmalar/${slug}` !== companyPath(company)) permanentRedirect(companyPath(company));

  const city = getCityByCode(company.cityCode);
  const crumbs: Crumb[] = [
    { name: "Ana sayfa", href: "/" },
    { name: "Evden eve nakliyat", href: HUB_PATH },
    ...(city ? [{ name: city.name, href: `/${citySlug(city)}` }] : []),
    { name: company.displayName, href: companyPath(company) },
  ];

  const earned = company.badges ?? [];
  const facts = [
    company.foundedYear && { label: "Kuruluş", value: String(company.foundedYear) },
    company.fleetSize && { label: "Araç", value: String(company.fleetSize) },
    company.staffSize && { label: "Ekip", value: `${company.staffSize} kişi` },
  ].filter((f): f is { label: string; value: string } => !!f);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 flex items-center gap-4">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- tarayıcıda küçültülmüş 192 px WebP, kalıcı adres
          <img
            src={company.logoUrl}
            alt={`${company.displayName} logosu`}
            width={72}
            height={72}
            className="h-16 w-16 shrink-0 rounded-xl border border-zinc-200 bg-white object-contain p-1 sm:h-[72px] sm:w-[72px]"
          />
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{company.displayName}</h1>
          {company.verified && !earned.includes("DOCUMENTS_VERIFIED") && <Badge tone="success">✓ Doğrulanmış firma</Badge>}
        </div>
      </div>
      <CompanyBadges badges={earned} className="mt-3" />
      <p className="mt-2 text-zinc-700">
        {company.cityName} merkezli
        {company.ratingCount > 0 && ` · ★ ${formatRating(company.ratingAverage)} (${company.ratingCount} yorum)`}
        {company.completedJobs > 0 && ` · ${company.completedJobs} tamamlanan taşıma`}
        {` · ${yearOf(company.memberSince)} yılından beri platformda`}
      </p>

      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <dt className="text-xs text-zinc-600">{f.label}</dt>
              <dd className="text-lg font-semibold text-zinc-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Card className="mt-6 p-5">
        <p className="text-zinc-800">
          Taşınma talebini oluştur; {company.displayName} dahil bölgendeki doğrulanmış firmalardan ücretsiz teklif al,
          fiyatları ve yorumları karşılaştırıp seç.
        </p>
        <ButtonLink href="/talep-olustur" size="lg" className="mt-4">
          Ücretsiz teklif al
        </ButtonLink>
      </Card>

      {company.description && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{company.displayName} hakkında</h2>
          <p className="mt-3 whitespace-pre-line text-zinc-800">{company.description}</p>
        </section>
      )}

      {company.services.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Hizmetler</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {company.services.map((code) => (
              <li key={code} className="flex items-center gap-2 text-zinc-800">
                <span aria-hidden className="text-brand-700">
                  ✓
                </span>
                {serviceLabel(code)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {company.photos.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Fotoğraflar</h2>
          <CompanyGallery photos={company.photos} companyName={company.displayName} />
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Neden doğrulanmış?</h2>
        <p className="mt-3 text-zinc-700">
          Firmanın K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı ekibimiz tarafından kontrol edildi
          {company.verifiedAt && ` (${new Date(company.verifiedAt).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" })})`}
          . K3 belgesinin süresi dolarsa firma yeni teklif veremez.
        </p>
      </section>

      {earned.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Rozetler</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Rozetler platformdaki güncel verilerden otomatik hesaplanır; koşul sağlanmazsa rozet kalkar.
          </p>
          <dl className="mt-4 space-y-3">
            {BADGE_ORDER.filter((code) => earned.includes(code)).map((code) => (
              <div key={code}>
                <dt>
                  <BadgePill code={code} />
                </dt>
                <dd className="mt-1 text-zinc-700">{BADGES[code].description}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {company.serviceCities.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Hizmet verdiği iller</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {company.serviceCities.map((c) => {
              const record = getCityByCode(c.code);
              return (
                <li key={c.code}>
                  {record ? (
                    <Link
                      href={`/${citySlug(record)}`}
                      className="inline-block rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-800 hover:border-brand-700 hover:text-brand-800"
                    >
                      {c.name} evden eve nakliyat
                    </Link>
                  ) : (
                    c.name
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="yorumlar" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold">Müşteri yorumları</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Yorumlar yalnızca bu firmayla platform üzerinden anlaşan ve taşınması tamamlanan müşterilerden gelir; her
          taşıma için bir değerlendirme yapılabilir. Kurallara aykırı yorumlar gerekçesiyle yayından kaldırılır.
        </p>
        <Card className="mt-4 p-5">
          <RatingSummary
            average={company.ratingAverage}
            count={company.ratingCount}
            distribution={company.ratingDistribution}
            headingLevel={3}
          />
        </Card>
        {reviews.items.length > 0 && (
          <ul className="mt-4 space-y-3">
            {reviews.items.map((r) => (
              <ReviewCard key={r.id} as="li" review={r} companyName={company.displayName} author={`${r.authorName} · ${r.route}`} />
            ))}
          </ul>
        )}
        {reviews.total > reviews.items.length && (
          <p className="mt-3 text-sm text-zinc-600">
            En yeni {reviews.items.length} yorum gösteriliyor (toplam {reviews.total}).
          </p>
        )}
      </section>

      <JsonLd data={companyJsonLd(company, reviews.items)} />
    </main>
  );
}
