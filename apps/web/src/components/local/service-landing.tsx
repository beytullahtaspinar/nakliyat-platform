import type { Metadata } from "next";
import Link from "next/link";
import { citySlug, type ServicePageSlug } from "@nakliyat/locations";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { CoverImage, imageObjectJsonLd } from "@/components/local/cover-image";
import { Faq } from "@/components/local/faq";
import { LinkGrid } from "@/components/local/link-grid";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { BLOG_PROSE } from "@/lib/blog/prose";
import { formatDate } from "@/lib/format";
import { HUB_PATH } from "@/lib/local-content";
import { getLocalPageContent } from "@/lib/local-page-content";
import { LAUNCH_CITIES, currentYear } from "@/lib/local-seo";
import { PRICE_CALCULATOR_PATH } from "@/lib/pricing";
import { loadPricingModel } from "@/lib/pricing-model";
import { SERVICE_PAGES, getServicePage, range, servicePath, type ServicePriceTable } from "@/lib/service-pages";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";

/** Hizmet sayfasının başlık ve açıklaması: yönetimden yazılan varsa o, yoksa otomatik metin */
export async function serviceMetadata(slug: ServicePageSlug): Promise<Metadata> {
  const page = getServicePage(slug);
  const year = currentYear();
  const custom = await getLocalPageContent(slug);
  const title = custom?.seoTitle ?? page.metaTitle(year);
  const description = custom?.seoDescription ?? page.description(year);
  const path = servicePath(slug);
  return {
    // Başlık şablonu ("| evdenevenakliyat.app") kök düzende eklenir
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", locale: "tr_TR", images: DEFAULT_OG_IMAGES },
  };
}

function PriceTable({ table, updatedAt }: { table: ServicePriceTable; updatedAt: string | null }) {
  const hasInfo = table.rows.some((r) => r.info);
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">{table.title}</h2>
      <p className="mt-2 text-zinc-600">
        {table.note} Tahmindir; kesin fiyatı firmalar eşyanızı görerek verir.
        {updatedAt && ` Katsayılar ${formatDate(updatedAt)} tarihinde güncellendi.`}
      </p>
      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label={table.ariaLabel}>
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col" className="py-2 pr-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.label} className="border-t border-zinc-200">
                <td className="py-2 pr-3">
                  {r.href ? (
                    <Link href={r.href} className="font-medium text-brand-700 hover:underline">
                      {r.label}
                    </Link>
                  ) : (
                    r.label
                  )}
                </td>
                {hasInfo && <td className="py-2 pr-3">{r.info}</td>}
                {r.cells.map((c, i) => (
                  <td key={i} className="whitespace-nowrap py-2 pr-3">
                    {range(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        href={PRICE_CALCULATOR_PATH}
        className="mt-4 inline-flex items-center gap-1.5 py-1 font-semibold text-brand-700 hover:underline"
      >
        Kendi bilgilerinle fiyat hesapla <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}

/** Fiyat tablosundaki en düşük ve en yüksek tahmin (yapısal veri) */
function offerJsonLd(table: ServicePriceTable | undefined) {
  const cells = table?.rows.flatMap((r) => r.cells) ?? [];
  if (cells.length === 0) return undefined;
  return {
    "@type": "AggregateOffer",
    priceCurrency: "TRY",
    lowPrice: Math.min(...cells.map((c) => c.minTry)),
    highPrice: Math.max(...cells.map((c) => c.maxTry)),
    description: "Tahmini fiyat aralığı; kesin fiyatı firmalar teklifle verir.",
  };
}

/**
 * Hizmet sayfası (ofis taşıma, parça eşya vb.). Yönetimden yazılan başlık, giriş, kapak, ek içerik ve SSS
 * otomatik metnin yerine geçer; fiyat tablosu, bölümler ve bağlantılar otomatik kalır.
 */
export async function ServiceLanding({ slug }: { slug: ServicePageSlug }) {
  const page = getServicePage(slug);
  const [model, custom] = await Promise.all([loadPricingModel(), getLocalPageContent(slug)]);
  const year = currentYear();
  const table = page.priceTable?.(model);
  const introParagraphs = (custom?.intro ?? page.intro).split(/\n\s*\n/);
  const faqItems = custom?.faq.length ? custom.faq : page.faq({ year, table });
  const path = servicePath(slug);

  const otherServices = SERVICE_PAGES.filter((p) => p.slug !== slug).map((p) => ({
    href: servicePath(p.slug),
    label: p.name,
  }));
  const cityLinks = [
    ...LAUNCH_CITIES.map((c) => ({ href: `/${citySlug(c)}`, label: `${c.name} evden eve nakliyat` })),
    { href: HUB_PATH, label: "Tüm iller (81 il)" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: "Ana sayfa", href: "/" },
          { name: "Evden eve nakliyat", href: HUB_PATH },
          { name: page.name, href: path },
        ]}
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{custom?.heading ?? page.heading}</h1>
      {introParagraphs.map((text) => (
        <p key={text} className="mt-4 text-lg text-zinc-700">
          {text}
        </p>
      ))}
      <ButtonLink href="/talep-olustur" size="lg" className="mt-6">
        Ücretsiz teklif al
      </ButtonLink>

      {custom?.cover && <CoverImage image={custom.cover} />}

      {table && <PriceTable table={table} updatedAt={model.updatedAt} />}

      {page.sections.map((section) => (
        <section key={section.title} className="mt-12">
          <h2 className="text-2xl font-semibold">{section.title}</h2>
          {section.items && (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-zinc-700">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.paragraphs?.map((text) => (
            <p key={text} className="mt-4 text-zinc-700">
              {text}
            </p>
          ))}
        </section>
      ))}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Nasıl teklif alınır?</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-700">
          <li>Nereden, nereye, ev tipi, kat, asansör ve tarih bilgilerini girin; ihtiyacınızı notlara yazın.</li>
          <li>Hizmet bölgenizdeki K3 belgeli, doğrulanmış firmalar fiyat ve hizmet kapsamıyla teklif göndersin.</li>
          <li>Teklifleri fiyat, kapsam, firma puanı ve müşteri yorumlarına göre karşılaştırıp seçin.</li>
        </ol>
        <ButtonLink href="/talep-olustur" variant="accent" className="mt-6">
          Ücretsiz teklif al
        </ButtonLink>
      </section>

      {custom?.html && (
        // İçerik renderContent ile temizlendi: yalnızca izin verilen etiket ve nitelikler kalır
        <section className={BLOG_PROSE} dangerouslySetInnerHTML={{ __html: custom.html }} />
      )}

      <Faq items={faqItems} />

      <LinkGrid title="Diğer hizmetler" links={otherServices} />
      <LinkGrid title="İllere göre evden eve nakliyat" links={cityLinks} />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: page.name,
          serviceType: page.serviceType,
          description: custom?.seoDescription ?? page.description(year),
          url: `${SITE_URL}${path}`,
          areaServed: { "@type": "Country", name: "Türkiye" },
          provider: { "@id": `${SITE_URL}/#organization` },
          offers: offerJsonLd(table),
          ...(custom?.cover && { image: imageObjectJsonLd(custom.cover, SITE_URL) }),
        }}
      />
    </main>
  );
}
