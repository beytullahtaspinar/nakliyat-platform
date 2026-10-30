import type { Metadata } from "next";
import Link from "next/link";
import { citySlug, getCities, getCityByCode, getDistanceKm, routeSlug } from "@nakliyat/locations";
import { estimatePrice } from "@nakliyat/pricing";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { CoverImage } from "@/components/local/cover-image";
import { Faq, type FaqItem } from "@/components/local/faq";
import { LinkGrid } from "@/components/local/link-grid";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { BLOG_PROSE } from "@/lib/blog/prose";
import { HUB_DEFAULTS, HUB_PATH } from "@/lib/local-content";
import { getLocalPageContent } from "@/lib/local-page-content";
import { LAUNCH_CITIES, currentYear } from "@/lib/local-seo";
import { MARKETING_PAGES } from "@/lib/marketing";
import { DEFAULT_INPUT, PRICE_CALCULATOR_PATH, formatTry } from "@/lib/pricing";
import { loadPricingModel } from "@/lib/pricing-model";
import { HOME_TYPES } from "@/lib/request-options";
import { DEFAULT_OG_IMAGES, SITE_URL } from "@/lib/site";

// Fiyat tablosu katsayılarla birlikte yenilenir (fiyat etiketi, 1 saat)
export const revalidate = 3600;

/** Örnek şehirler arası güzergâh: en çok aranan rota */
const EXAMPLE_FROM = getCityByCode("34")!;
const EXAMPLE_TO = getCityByCode("06")!;
const EXAMPLE_KM = getDistanceKm(EXAMPLE_FROM, EXAMPLE_TO)!;

/** Yönetimden düzenlenirken kullanılan adres (bölge sayfalarıyla aynı tablo) */
const HUB_SLUG = HUB_PATH.slice(1);

export async function generateMetadata(): Promise<Metadata> {
  const year = currentYear();
  const custom = await getLocalPageContent(HUB_SLUG);
  const title = custom?.seoTitle ?? HUB_DEFAULTS.metaTitle(year);
  const description = custom?.seoDescription ?? HUB_DEFAULTS.description(year);
  return {
    title,
    description,
    alternates: { canonical: HUB_PATH },
    openGraph: { title, description, url: HUB_PATH, type: "website", locale: "tr_TR", images: DEFAULT_OG_IMAGES },
  };
}

function faq(year: number, twoPlusOne: { min: number; max: number }, intercity: { min: number; max: number }): FaqItem[] {
  return [
    {
      question: `Evden eve nakliyat fiyatları ${year} yılında ne kadar?`,
      answer: `Asansörlü binalar arasında, ortalama eşyalı bir 2+1 ev için şehir içi taşımanın tahmini fiyatı ${formatTry(twoPlusOne.min)} ile ${formatTry(twoPlusOne.max)} arasındadır. ${EXAMPLE_FROM.name} - ${EXAMPLE_TO.name} gibi yaklaşık ${EXAMPLE_KM} km'lik şehirler arası taşımada aynı ev için aralık ${formatTry(intercity.min)} - ${formatTry(intercity.max)} olur. Kesin fiyatı firmalar eşyanızı ve adres koşullarını görerek verir.`,
    },
    {
      question: "Evden eve nakliyat fiyatını neler belirler?",
      answer:
        "Eşya hacmi (ev tipi ve eşya miktarı), iki adresteki kat ve asansör durumu, mesafe, paketleme ve mobilya söküm-kurulum gibi ek hizmetler ve taşınma tarihi. Ay sonu, hafta sonu ve yaz ayları daha yoğun olduğu için fiyatlar yükselebilir.",
    },
    {
      question: "Evden eve nakliyat fiyat teklifi nasıl alınır?",
      answer:
        "Nereden, nereye, ev tipi, kat ve tarih bilgilerini bir kez girersiniz. Hizmet bölgenizdeki doğrulanmış firmalar fiyat ve hizmet kapsamıyla teklif gönderir. Teklif almak ücretsizdir ve hiçbirini kabul etmek zorunda değilsiniz.",
    },
    {
      question: "Nakliyat firmasının güvenilir olduğunu nasıl anlarım?",
      answer:
        "Ulaştırma ve Altyapı Bakanlığı'nın verdiği K3 yetki belgesine, vergi levhasına ve ticaret sicil kaydına bakın. Platformdaki firmaların bu belgeleri tek tek incelenir; K3 belgesinin süresi dolan firma teklif veremez. Firma puanları yalnızca platform üzerinden taşınan gerçek müşterilerden gelir.",
    },
    {
      question: "Şehirler arası nakliyat fiyatı nasıl hesaplanır?",
      answer:
        "Şehir içi taşımadaki işçilik ve ek hizmetlere, iki il arasındaki karayolu mesafesi ve aracın dönüş yolu eklenir. Eşyanız tek araca sığmıyorsa araç sayısı da fiyatı artırır.",
    },
  ];
}

export default async function HubPage() {
  const [{ settings, calibration, updatedAt }, custom] = await Promise.all([loadPricingModel(), getLocalPageContent(HUB_SLUG)]);
  const year = currentYear();
  const estimate = (homeType: (typeof HOME_TYPES)[number]["value"], distanceKm?: number) =>
    estimatePrice({ ...DEFAULT_INPUT, homeType, distanceKm }, settings, calibration);
  const rows = HOME_TYPES.filter((t) => t.value !== "OFFICE").map((t) => ({
    label: t.label,
    local: estimate(t.value),
    intercity: estimate(t.value, EXAMPLE_KM),
  }));
  const twoPlusOne = rows.find((r) => r.label === "2+1")!;
  // Yönetimden yazılan metin otomatik metnin yerine geçer; boş alanlar otomatik kalır
  const faqItems = custom?.faq.length
    ? custom.faq
    : faq(
        year,
        { min: twoPlusOne.local.minTry, max: twoPlusOne.local.maxTry },
        { min: twoPlusOne.intercity.minTry, max: twoPlusOne.intercity.maxTry },
      );

  const cityLinks = getCities().map((c) => ({ href: `/${citySlug(c)}`, label: c.name }));
  const routeLinks = LAUNCH_CITIES.flatMap((from) =>
    LAUNCH_CITIES.filter((to) => to !== from).map((to) => ({
      href: `/${routeSlug(from, to)}`,
      label: `${from.name} - ${to.name}`,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: "Ana sayfa", href: "/" },
          { name: "Evden eve nakliyat", href: HUB_PATH },
        ]}
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {custom?.heading ?? HUB_DEFAULTS.heading}
      </h1>
      {(custom?.intro ?? HUB_DEFAULTS.intro).split(/\n\s*\n/).map((text) => (
        <p key={text} className="mt-4 text-lg text-zinc-700">
          {text}
        </p>
      ))}
      <ButtonLink href="/talep-olustur" size="lg" className="mt-6">
        Ücretsiz teklif al
      </ButtonLink>

      {custom?.cover && <CoverImage image={custom.cover} />}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Evden eve nakliyat fiyatları {year}</h2>
        <p className="mt-2 text-zinc-600">
          Ev tipine göre tahmini fiyat aralığı: ortalama eşya, iki adreste de 2. kat ve asansörlü bina, paketleme ve
          montaj hariç. Şehirler arası sütun {EXAMPLE_FROM.name} - {EXAMPLE_TO.name} (yaklaşık {EXAMPLE_KM} km) içindir.
          {updatedAt && ` Katsayılar ${formatDate(updatedAt)} tarihinde güncellendi.`}
        </p>
        <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Ev tipine göre tahmini evden eve nakliyat fiyatları">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-2">Ev tipi</th>
                <th scope="col" className="py-2">Şehir içi</th>
                <th scope="col" className="py-2">Şehirler arası</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-zinc-200">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2">
                    {formatTry(r.local.minTry)} - {formatTry(r.local.maxTry)}
                  </td>
                  <td className="py-2">
                    {formatTry(r.intercity.minTry)} - {formatTry(r.intercity.maxTry)}
                  </td>
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

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Nakliyat fiyat teklifi nasıl alınır?</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-700">
          <li>Nereden, nereye, ev tipi, kat, asansör ve tarih bilgilerini girin.</li>
          <li>Hizmet bölgenizdeki doğrulanmış firmalar fiyat ve hizmet kapsamıyla teklif göndersin.</li>
          <li>Teklifleri fiyat, kapsam, firma puanı ve müşteri yorumlarına göre karşılaştırıp seçin.</li>
        </ol>
        <Link
          href={MARKETING_PAGES.howItWorks.href}
          className="mt-4 inline-flex items-center gap-1.5 py-1 font-semibold text-brand-700 hover:underline"
        >
          Ayrıntılı anlatım <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </section>

      <LinkGrid title="İllere göre evden eve nakliyat" links={cityLinks} />
      <LinkGrid title="Popüler şehirler arası güzergâhlar" links={routeLinks} />

      {custom?.html && (
        // İçerik renderContent ile temizlendi: yalnızca izin verilen etiket ve nitelikler kalır
        <section className={BLOG_PROSE} dangerouslySetInnerHTML={{ __html: custom.html }} />
      )}

      <Faq items={faqItems} />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Evden eve nakliyat",
          serviceType: "Evden eve nakliyat",
          description: `Evden eve nakliyat fiyatları ${year} ve 81 ilde doğrulanmış firmalardan ücretsiz fiyat teklifi.`,
          url: `${SITE_URL}${HUB_PATH}`,
          areaServed: { "@type": "Country", name: "Türkiye" },
          provider: { "@id": `${SITE_URL}/#organization` },
        }}
      />
    </main>
  );
}
