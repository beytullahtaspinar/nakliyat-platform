import type { Metadata } from "next";
import Link from "next/link";
import { getCities, getCityByCode, getDistanceKm, routeSlug } from "@nakliyat/locations";
import {
  DEFAULT_PRICING_SETTINGS,
  PRICING_SETTING_SPECS,
  estimatePrice,
  type PricingSettingKey,
} from "@nakliyat/pricing";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { Faq, type FaqItem } from "@/components/local/faq";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { HUB_PATH } from "@/lib/local-content";
import { DEFAULT_INPUT, PRICE_CALCULATOR_PATH, PRICING_CACHE_TAG, formatTry, type PricingModel } from "@/lib/pricing";
import { HOME_TYPES } from "@/lib/request-options";
import { SITE_URL } from "@/lib/site";
import { PriceCalculator, type CalculatorCity } from "./price-calculator";

// Katsayılar bir saat önbellekte kalır; yönetimden değişince sunucu eylemi hemen yeniler (updateTag)
export const revalidate = 3600;

const TITLE = "Nakliyat fiyat hesaplama";
const DESCRIPTION =
  "Ev tipini, eşya miktarını, kat ve asansör durumunu, nereden nereye taşınacağını seç; evden eve ve şehirler arası nakliyat için tahmini fiyat aralığını hemen gör. Ücretsiz, kayıt gerektirmez.";

export const metadata: Metadata = {
  title: "Nakliyat Fiyat Hesaplama: Evden Eve Taşıma Ücreti Ne Kadar?",
  description: DESCRIPTION,
  alternates: { canonical: PRICE_CALCULATOR_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PRICE_CALCULATOR_PATH, type: "website", locale: "tr_TR" },
};

/** API'ye ulaşılamazsa (ör. derleme sırasında) varsayılan katsayılarla çizilir, sonraki yenilemede düzelir */
async function loadModel(): Promise<PricingModel> {
  try {
    return await apiFetch<PricingModel>("/pricing", { revalidate, tags: [PRICING_CACHE_TAG] });
  } catch {
    return { settings: DEFAULT_PRICING_SETTINGS, calibration: {}, updatedAt: null };
  }
}

const cityRecords = getCities();
const cities: CalculatorCity[] = cityRecords.map(({ code, name }) => ({ code, name }));
const distances = cityRecords.flatMap((a, i) => cityRecords.slice(i + 1).map((b) => getDistanceKm(a, b) ?? 0));

/** Örnek tablo güzergâhı: en çok aranan şehirler arası rota */
const EXAMPLE_FROM = getCityByCode("34")!;
const EXAMPLE_TO = getCityByCode("06")!;
const EXAMPLE_KM = getDistanceKm(EXAMPLE_FROM, EXAMPLE_TO)!;

/** Fiyatı oluşturan katsayılar (sayfada şeffaflık için gösterilir) */
const COST_KEYS: PricingSettingKey[] = [
  "baseFeeTry",
  "laborPerM3Try",
  "stairsPerFloorPct",
  "packingPerM3Try",
  "assemblyPerM3Try",
  "localTransportTry",
  "perKmTry",
  "vehicleCapacityM3",
];

const FACTORS = [
  { title: "Eşya hacmi", text: "Ev tipine göre ortalama hacim (stüdyo ~10 m³, 2+1 ~25 m³, 4+1 ~45 m³) eşya miktarına göre artırılıp azaltılır. İşçilik ve araç sayısı hacimden çıkar." },
  { title: "Kat ve asansör", text: "Asansörsüz her kat taşıma süresini uzatır. Bina asansörü yoksa ve kat yüksekse firmalar dış cephe asansörü de önerebilir." },
  { title: "Mesafe", text: "Şehirler arası taşımada il merkezleri arası karayolu mesafesi ve aracın dönüş yolu hesaba katılır. Şehir içinde araç başına sabit yol ücreti kullanılır." },
  { title: "Ek hizmetler", text: "Paketleme ve mobilya söküm-kurulumu hacme göre fiyata eklenir. Depolama ve özel eşyalar (piyano, kasa) firmalarca ayrıca fiyatlandırılır." },
];

function faq(example: { min: number; max: number }): FaqItem[] {
  return [
    {
      question: "Hesaplanan fiyat kesin mi?",
      answer:
        "Hayır, bir tahmindir. Kesin fiyatı nakliyat firmaları eşyalarını, adresteki koşulları ve taşınma tarihini görerek verir. Hesaplayıcı, gelen teklifleri değerlendirirken makul aralığı bilmen için vardır.",
    },
    {
      question: "2+1 ev taşıma ne kadar tutar?",
      answer: `Asansörlü binalar arasında, ortalama eşyalı bir 2+1 ev için şehir içi taşımanın tahmini fiyatı ${formatTry(example.min)} ile ${formatTry(example.max)} arasındadır. Kat, asansör, paketleme ve mesafe bu aralığı değiştirir; kendi bilgilerinle hesaplamak için yukarıdaki aracı kullan.`,
    },
    {
      question: "Fiyat hesabında hangi veriler kullanılıyor?",
      answer:
        "Ortalama işçilik, araç ve km maliyetlerinden oluşan katsayılar ve platformda gerçekleşen anlaşmalar. Bir grupta (şehir içi ya da şehirler arası) yeterli anlaşma biriktiğinde tahmin, platformdaki gerçek anlaşma fiyatlarına göre ayarlanır. Başka sitelerden fiyat verisi alınmaz.",
    },
    {
      question: "Neden tek bir fiyat değil de aralık gösteriliyor?",
      answer:
        "Aynı ev tipinde bile eşya miktarı, bina girişi, aracın yaklaşabildiği mesafe ve tarih fiyatı değiştirir. Aralık, benzer taşınmalarda karşılaşılabilecek alt ve üst fiyatı gösterir.",
    },
    {
      question: "Şehirler arası mesafe nasıl hesaplanıyor?",
      answer:
        "Seçilen iki ilin merkezleri arasındaki karayolu mesafesi kullanılır. Talep oluştururken adresleri haritada işaretlersen firmalar gerçek güzergâhı görür.",
    },
    {
      question: "Kesin fiyatı nasıl öğrenirim?",
      answer:
        "Hesaplayıcıdaki bilgilerle ücretsiz talep oluştur. Hizmet bölgesindeki doğrulanmış firmalar fiyat ve hizmet kapsamıyla teklif verir; karşılaştırıp istediğini seçersin, hiçbirini kabul etmek zorunda değilsin.",
    },
  ];
}

export default async function PriceCalculatorPage() {
  const { settings, calibration, updatedAt } = await loadModel();
  const example = (homeType: (typeof HOME_TYPES)[number]["value"], distanceKm?: number) =>
    estimatePrice({ ...DEFAULT_INPUT, homeType, distanceKm }, settings, calibration);
  const twoPlusOne = example("TWO_PLUS_ONE");
  const faqItems = faq({ min: twoPlusOne.minTry, max: twoPlusOne.maxTry });
  const asOf = updatedAt ? formatDate(updatedAt) : null;

  return (
    <main className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}${PRICE_CALCULATOR_PATH}`,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Tüm tarayıcılar",
          inLanguage: "tr-TR",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: 0, priceCurrency: "TRY" },
          provider: { "@id": `${SITE_URL}/#organization` },
        }}
      />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
          <Breadcrumbs
            items={[
              { name: "Ana sayfa", href: "/" },
              { name: "Fiyat hesaplama", href: PRICE_CALCULATOR_PATH },
            ]}
          />
          <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-tight text-zinc-900 sm:text-4xl">
            Evden eve nakliyat fiyat hesaplama
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-zinc-600">
            Taşınma bilgilerini seç, tahmini fiyat aralığını hemen gör. Kayıt gerekmez; beğenirsen aynı bilgilerle
            doğrulanmış firmalardan gerçek teklif al.
          </p>
          <div className="mt-8">
            <PriceCalculator cities={cities} distances={distances} settings={settings} calibration={calibration} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="ornek-fiyatlar" className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          Ev tipine göre tahmini nakliyat fiyatları
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Ortalama eşya, asansörlü binalar, 2. kattan 2. kata, paketleme ve montaj hariç. Şehirler arası örnek:{" "}
          <Link href={`/${routeSlug(EXAMPLE_FROM, EXAMPLE_TO)}`} className="font-medium text-brand-700 underline">
            {EXAMPLE_FROM.name} – {EXAMPLE_TO.name}
          </Link>{" "}
          (yaklaşık {EXAMPLE_KM} km).{asOf && ` Katsayılar ${asOf} tarihinde güncellendi.`}
        </p>
        {/* Telefonda tablo kendi kutusunda kayar; kutu klavyeyle de kaydırılabilsin diye odaklanabilir */}
        <div
          role="region"
          aria-labelledby="ornek-fiyatlar"
          tabIndex={0}
          className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200 bg-white"
        >
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Ev tipine göre tahmini fiyat aralıkları (TL)</caption>
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Ev tipi</th>
                <th scope="col" className="px-4 py-3 font-semibold">Eşya hacmi</th>
                <th scope="col" className="px-4 py-3 font-semibold">Şehir içi</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {EXAMPLE_FROM.name} – {EXAMPLE_TO.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {HOME_TYPES.map((t) => {
                const local = example(t.value);
                const intercity = example(t.value, EXAMPLE_KM);
                return (
                  <tr key={t.value} className="border-t border-zinc-200">
                    <th scope="row" className="px-4 py-3 font-medium text-zinc-900">{t.label}</th>
                    <td className="px-4 py-3 text-zinc-600">~{local.volumeM3} m³</td>
                    <td className="px-4 py-3">{formatTry(local.minTry)} – {formatTry(local.maxTry)}</td>
                    <td className="px-4 py-3">{formatTry(intercity.minTry)} – {formatTry(intercity.maxTry)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-zinc-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Fiyat nasıl hesaplanıyor?</h2>
            <ul className="mt-6 space-y-5">
              {FACTORS.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
                  <div>
                    <h3 className="font-semibold text-zinc-900">{f.title}</h3>
                    <p className="mt-1 text-zinc-600">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Hesapta kullanılan değerler</h2>
            <p className="mt-3 text-zinc-600">
              Tahmin bu katsayılarla hesaplanır. Platformda yeterli anlaşma biriken gruplarda sonuç, gerçek anlaşma
              fiyatlarına göre ayarlanır.
            </p>
            <dl className="mt-6 divide-y divide-zinc-200 rounded-[var(--radius-card)] border border-zinc-200 bg-white">
              {COST_KEYS.map((key) => (
                <div key={key} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-zinc-700">{PRICING_SETTING_SPECS[key].label}</dt>
                  <dd className="whitespace-nowrap font-semibold text-zinc-900">
                    {settings[key].toLocaleString("tr-TR")} {PRICING_SETTING_SPECS[key].unit}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <Faq items={faqItems} />
        <div className="mt-12 rounded-[var(--radius-card)] bg-brand-900 p-8 text-center text-white">
          <h2 className="text-2xl font-bold">Gerçek fiyatı firmalardan al</h2>
          <p className="mt-2 text-brand-100">
            Tahmin yol gösterir, teklif kesinleştirir. Talebini bir kez gir, doğrulanmış firmalar fiyat versin.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/talep-olustur" variant="inverse" size="lg">
              Ücretsiz teklif al <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <Link
              href={HUB_PATH}
              className="inline-flex items-center rounded-xl border border-white/30 px-6 py-3.5 font-semibold text-white hover:bg-white/10"
            >
              İllere göre nakliyat
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
