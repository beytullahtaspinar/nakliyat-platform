import { getAllLocalPages, getCityBySlug, resolveLocalPage, type CityRecord, type LocalPage } from "@nakliyat/locations";
import { HUB_DEFAULTS, HUB_PATH, intro } from "@/lib/local-content";
import { currentYear, isIndexable, localPageDescription, localPageMetaTitle, localPageTitle } from "@/lib/local-seo";

/** Yönetimde düzenlenebilen bölge sayfası: merkez sayfa ya da il, ilçe, güzergâh sayfası */
export type EditablePage = {
  slug: string;
  kind: "hub" | LocalPage["kind"];
  title: string;
  indexable: boolean;
  /** Yönetim listesinde bağlı olduğu il (güzergâhta çıkış ili); Türkiye geneli sayfasında yok */
  city: { slug: string; name: string } | null;
  /** Yönetim formunda yer tutucu olarak görünen otomatik metinler */
  defaults: { seoTitle: string; seoDescription: string; heading: string; intro: string };
};

export const PAGE_KIND_LABELS: Record<EditablePage["kind"], string> = {
  hub: "Türkiye geneli",
  city: "İl",
  district: "İlçe",
  route: "Şehirler arası",
};

export const HUB_SLUG = HUB_PATH.slice(1);

function hubPage(): EditablePage {
  const year = currentYear();
  return {
    slug: HUB_SLUG,
    kind: "hub",
    title: "Türkiye geneli evden eve nakliyat",
    indexable: true,
    city: null,
    defaults: {
      seoTitle: HUB_DEFAULTS.metaTitle(year),
      seoDescription: HUB_DEFAULTS.description(year),
      heading: HUB_DEFAULTS.heading,
      intro: HUB_DEFAULTS.intro,
    },
  };
}

function toEditable(page: LocalPage): EditablePage {
  return {
    slug: page.slug,
    kind: page.kind,
    title: localPageTitle(page),
    indexable: isIndexable(page),
    city: (({ slug, name }) => ({ slug, name }))(page.kind === "route" ? page.from : page.city),
    defaults: {
      seoTitle: localPageMetaTitle(page),
      seoDescription: localPageDescription(page),
      heading: localPageTitle(page),
      intro: intro(page),
    },
  };
}

export function getEditablePage(slug: string): EditablePage | null {
  if (slug === HUB_SLUG) return hubPage();
  const page = resolveLocalPage(slug);
  return page ? toEditable(page) : null;
}

/**
 * Yönetim listesi: arama yoksa merkez sayfa ve arama motoruna açık sayfalar (düzenlenenler her zaman);
 * aramada dizine kapalı ilçe ve güzergâh sayfaları da bulunur.
 */
export function listEditablePages(q: string | undefined, edited: Set<string>): EditablePage[] {
  const needle = q?.toLocaleLowerCase("tr-TR");
  const pages = [hubPage(), ...getAllLocalPages().map(toEditable)];
  return pages.filter((p) =>
    needle
      ? p.title.toLocaleLowerCase("tr-TR").includes(needle) || p.slug.includes(needle)
      : p.indexable || edited.has(p.slug),
  );
}

/** Yönetimde il grubu: il sayfası, ilçe sayfaları ve o ilden çıkan şehirler arası sayfalar */
export type CityGroup = {
  city: CityRecord;
  page: LocalPage;
  districts: LocalPage[];
  routes: LocalPage[];
};

const trCompare = (a: string, b: string) => a.localeCompare(b, "tr-TR");

/** 81 il, adına göre sıralı; sayfalar metinsiz (sayım için hafif) */
export function listCityGroups(): CityGroup[] {
  const groups = new Map<string, CityGroup>();
  const pages = getAllLocalPages();
  for (const page of pages) {
    if (page.kind === "city") groups.set(page.city.slug, { city: page.city, page, districts: [], routes: [] });
  }
  for (const page of pages) {
    if (page.kind === "district") groups.get(page.city.slug)!.districts.push(page);
    else if (page.kind === "route") groups.get(page.from.slug)!.routes.push(page);
  }
  return [...groups.values()].sort((a, b) => trCompare(a.city.name, b.city.name));
}

/** İl ayrıntısı: arama motoruna açık sayfalar önce, sonra ada göre */
export function getCityGroupPages(slug: string) {
  const city = getCityBySlug(slug);
  if (!city) return null;
  const group = listCityGroups().find((g) => g.city.slug === city.slug)!;
  const sorted = (pages: LocalPage[]) =>
    pages.map(toEditable).sort((a, b) => Number(b.indexable) - Number(a.indexable) || trCompare(a.title, b.title));
  return { city, page: toEditable(group.page), districts: sorted(group.districts), routes: sorted(group.routes) };
}
