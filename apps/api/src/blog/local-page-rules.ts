import { resolveLocalPage } from '@nakliyat/locations';

/** Bölge sayfası içerik kuralları. Web tarafındaki karşılığı: apps/web/src/lib/local-page-content.ts */
export const LOCAL_PAGE_RULES = {
  headingMax: 120,
  introMax: 1500,
} as const;

/** Türkiye geneli merkez sayfası */
export const HUB_SLUG = 'evden-eve-nakliyat';

/** Düzenlenebilir sayfa: merkez sayfa ya da var olan il, ilçe veya güzergâh sayfası */
export const isLocalPageSlug = (slug: string) => slug === HUB_SLUG || resolveLocalPage(slug) !== undefined;
