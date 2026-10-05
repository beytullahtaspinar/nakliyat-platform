import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocalPage, type LocalPage } from "@nakliyat/locations";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { Faq } from "@/components/local/faq";
import { LinkGrid } from "@/components/local/link-grid";
import { LocalCompanies } from "@/components/local/local-companies";
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
  isIndexable,
  localPageDescription,
  localPageTitle,
} from "@/lib/local-seo";
import { getLocalCompanies } from "@/lib/local-companies";
import { getLocalStats } from "@/lib/local-stats";
import { calculatorHref } from "@/lib/pricing";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";

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
  const title = localPageTitle(page);
  const description = localPageDescription(page);
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

export default async function LocalLandingPage({ params }: Props) {
  const page = await loadPage(params);
  const [stats, companies] = await Promise.all([getLocalStats(page), getLocalCompanies(page)]);
  // İlçe sayfasında da il geneli: firmalar il bazında hizmet verir
  const region = page.kind === "route" ? `${page.from.name} - ${page.to.name} arasında` : `${page.city.name} ilinde`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs items={breadcrumbs(page)} />

      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {localPageTitle(page)}
      </h1>
      <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">{intro(page)}</p>

      <ButtonLink href={requestHref(page)} size="lg" className="mt-6">
        Ücretsiz teklif al
      </ButtonLink>

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

      <Faq items={faq(page)} />

      {relatedLinks(page).map((group) => (
        <LinkGrid key={group.title} title={group.title} links={group.links} />
      ))}

      <JsonLd data={serviceJsonLd(page)} />
    </main>
  );
}
