import {
  citySlug,
  districtSlug,
  getNearestCities,
  routeSlug,
  type LocalPage,
} from "@nakliyat/locations";
import type { Crumb } from "@/components/local/breadcrumbs";
import type { FaqItem } from "@/components/local/faq";
import { isIndexable, localPageTitle } from "./local-seo";

export const HUB_PATH = "/evden-eve-nakliyat";

const hoursOnRoad = (km: number) =>
  Math.max(1, Math.round((km / 70) * 2) / 2).toLocaleString("tr-TR");

export function placeName(page: LocalPage): string {
  switch (page.kind) {
    case "city":
      return page.city.name;
    case "district":
      return `${page.city.name}, ${page.district.name}`;
    case "route":
      return `${page.from.name} - ${page.to.name}`;
  }
}

export function breadcrumbs(page: LocalPage): Crumb[] {
  const base: Crumb[] = [
    { name: "Ana sayfa", href: "/" },
    { name: "Evden eve nakliyat", href: HUB_PATH },
  ];
  switch (page.kind) {
    case "city":
      return [...base, { name: page.city.name, href: `/${page.slug}` }];
    case "district":
      return [
        ...base,
        { name: page.city.name, href: `/${citySlug(page.city)}` },
        { name: page.district.name, href: `/${page.slug}` },
      ];
    case "route":
      return [
        ...base,
        { name: page.from.name, href: `/${citySlug(page.from)}` },
        { name: `${page.from.name} - ${page.to.name}`, href: `/${page.slug}` },
      ];
  }
}

export function intro(page: LocalPage): string {
  switch (page.kind) {
    case "city":
      return `${page.city.name} içinde veya ${page.city.name} çıkışlı taşınacaksanız bilgilerinizi bir kez girin; bölgede hizmet veren doğrulanmış nakliyat firmaları size fiyat ve hizmet kapsamıyla teklif versin. Teklifleri firma puanı, müşteri yorumları ve tamamlanan iş sayısına göre karşılaştırıp size en uygun olanı seçin.`;
    case "district":
      return `${page.district.name} (${page.city.name}) adresinizden taşınırken tek tek firma aramanıza gerek yok. Kat, asansör ve eşya bilgilerinizi girin; ${page.city.name} genelinde ${page.district.name} bölgesine hizmet veren doğrulanmış firmalardan teklifleri tek ekranda karşılaştırın.`;
    case "route":
      return `${page.from.name} ile ${page.to.name} arası karayolu mesafesi yaklaşık ${page.distanceKm} km, yalnızca yol süresi ortalama ${hoursOnRoad(page.distanceKm)} saattir. Şehirler arası taşınmanız için bu güzergâhta çalışan doğrulanmış firmalardan teklif alın, fiyatları ve hizmet kapsamlarını karşılaştırın.`;
  }
}

export function priceFactors(page: LocalPage): string[] {
  const common = [
    "Evin büyüklüğü ve eşya hacmi (m³)",
    "Çıkış ve varış adreslerindeki kat sayısı ve asansör durumu",
    "Paketleme, demontaj-montaj ve sigorta gibi ek hizmetler",
    "Taşınma tarihi: ay sonu, hafta sonu ve yaz ayları daha yoğundur",
  ];
  if (page.kind === "route") {
    return [
      `Mesafe: ${page.from.name} - ${page.to.name} arası yaklaşık ${page.distanceKm} km`,
      "Eşyanın tek araçla mı yoksa parça eşya (parsiyel) olarak başka yüklerle birlikte mi taşınacağı",
      ...common,
    ];
  }
  return [...common, "Binaya aracın ne kadar yaklaşabildiği ve dış cephe asansörü ihtiyacı"];
}

export function faq(page: LocalPage): FaqItem[] {
  const place = placeName(page);
  const items: FaqItem[] = [
    {
      question: `${localPageTitle(page)} fiyatları neye göre belirlenir?`,
      answer:
        "Fiyatı en çok eşya hacmi, kat ve asansör durumu, mesafe ve paketleme-montaj gibi ek hizmetler belirler. Aynı bilgilerle birden fazla firmadan teklif almak, piyasa fiyatını görmenin en güvenilir yoludur.",
    },
    {
      question: "Teklif almak ücretli mi, beni bağlar mı?",
      answer:
        "Hayır. Talep oluşturmak ve teklif almak ücretsizdir. Gelen teklifleri inceleyip dilediğinizi seçersiniz; hiçbirini kabul etmek zorunda değilsiniz.",
    },
    {
      question: "Firmalar nasıl doğrulanıyor?",
      answer:
        "Platformdaki firmalardan Ulaştırma ve Altyapı Bakanlığı K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı istenir. Belgeleri onaylanmayan firmalar teklif veremez. Yorumları ise yalnızca o firmayla taşınmış müşteriler yazabilir.",
    },
    {
      question: `${place} için ne kadar önceden teklif almalıyım?`,
      answer:
        "Taşınma tarihinizden en az 1-2 hafta önce, ay sonu veya yaz aylarına denk geliyorsa 3-4 hafta önce teklif almanız uygun tarih ve fiyat bulmanızı kolaylaştırır.",
    },
  ];
  if (page.kind === "route") {
    items.splice(1, 0, {
      question: `${page.from.name} ${page.to.name} arası taşınma kaç gün sürer?`,
      answer: `Güzergâh yaklaşık ${page.distanceKm} km ve yalnızca yol süresi ortalama ${hoursOnRoad(page.distanceKm)} saattir. Yükleme ve boşaltma ile birlikte süre eşya miktarına göre değişir; kesin teslim tarihi firmaların tekliflerinde belirtilir.`,
    });
    items.push({
      question: "Eşyam az, daha uygun bir seçenek var mı?",
      answer:
        "Evet. Parça eşya (parsiyel) taşımada eşyanız aynı yöne giden başka yüklerle birlikte taşınır ve genellikle daha ekonomiktir. Talep formunda bunu belirtirseniz firmalar buna göre teklif verir.",
    });
  }
  return items;
}

type Link = { href: string; label: string };

export function relatedLinks(page: LocalPage): { title: string; links: Link[] }[] {
  const only = (links: (Link & { page: LocalPage })[]) =>
    links.filter((l) => isIndexable(l.page)).map(({ href, label }) => ({ href, label }));

  const city = page.kind === "route" ? page.from : page.city;
  const districtLinks = only(
    city.districts.map((district) => {
      const slug = districtSlug(city, district);
      return {
        href: `/${slug}`,
        label: `${district.name} evden eve nakliyat`,
        page: { kind: "district" as const, slug, city, district },
      };
    }),
  ).filter((l) => l.href !== `/${page.slug}`);

  const nearest = getNearestCities(city, 6);
  const nearbyCityLinks = nearest.map(({ city: c }) => ({
    href: `/${citySlug(c)}`,
    label: `${c.name} evden eve nakliyat`,
  }));
  const routeLinks = only(
    nearest.map(({ city: to, distanceKm }) => {
      const slug = routeSlug(city, to);
      return {
        href: `/${slug}`,
        label: `${city.name} - ${to.name} (${distanceKm} km)`,
        page: { kind: "route" as const, slug, from: city, to, distanceKm },
      };
    }),
  );

  switch (page.kind) {
    case "city":
      return [
        { title: `${city.name} ilçelerinde evden eve nakliyat`, links: districtLinks },
        { title: `${city.name} çıkışlı şehirler arası nakliyat`, links: routeLinks },
        { title: "Yakın illerde evden eve nakliyat", links: nearbyCityLinks },
      ];
    case "district":
      return [
        {
          title: `${city.name} genelinde evden eve nakliyat`,
          links: [{ href: `/${citySlug(city)}`, label: `${city.name} evden eve nakliyat` }],
        },
        { title: `${city.name} içindeki diğer ilçeler`, links: districtLinks },
      ];
    case "route": {
      const reverse = routeSlug(page.to, page.from);
      return [
        {
          title: "İlgili sayfalar",
          links: [
            { href: `/${citySlug(page.from)}`, label: `${page.from.name} evden eve nakliyat` },
            { href: `/${citySlug(page.to)}`, label: `${page.to.name} evden eve nakliyat` },
            { href: `/${reverse}`, label: `${page.to.name} - ${page.from.name} nakliyat` },
          ],
        },
      ];
    }
  }
}

export function requestHref(page: LocalPage): string {
  const params = new URLSearchParams();
  if (page.kind === "route") {
    params.set("nereden", page.from.code);
    params.set("nereye", page.to.code);
  } else {
    params.set("nereden", page.city.code);
    if (page.kind === "district") params.set("ilce", page.district.slug);
  }
  return `/talep-olustur?${params}`;
}
