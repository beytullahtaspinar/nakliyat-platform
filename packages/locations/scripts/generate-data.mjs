// Türkiye il/ilçe ve iller arası karayolu mesafesi verisini src/data.ts dosyasına yazar.
// Kaynak: turkey-neighbourhoods (PTT posta kodu listesi ve KGM mesafe tablosu, MIT lisanslı).
// Güncellemek için: pnpm --filter @nakliyat/locations data:update
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCities, getDistrictsOfEachCity, findDistance } from 'turkey-neighbourhoods';

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const slugify = (s) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]|i̇/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const districtsByCity = getDistrictsOfEachCity();
const cities = getCities().map(({ code, name }) => ({
  code,
  name,
  slug: slugify(name),
  districts: [...districtsByCity[code]]
    .sort((a, b) => a.localeCompare(b, 'tr'))
    .map((d) => ({ name: d, slug: slugify(d) })),
}));

// Aynı il içinde çakışan ilçe adresi olmamalı
for (const c of cities) {
  const seen = new Set();
  for (const d of c.districts) {
    if (seen.has(d.slug)) throw new Error(`Çakışan ilçe adresi: ${c.name}/${d.slug}`);
    seen.add(d.slug);
  }
}

const codes = cities.map((c) => c.code);
const distances = {};
for (const a of codes) {
  distances[a] = {};
  for (const b of codes) {
    if (a !== b) distances[a][b] = findDistance(a, b);
  }
}

const header = `// Bu dosya scripts/generate-data.mjs tarafından üretilir, elle düzenlemeyin.\n`;
const body =
  header +
  `import type { CityRecord } from './types.js';\n\n` +
  `export const CITY_RECORDS: CityRecord[] = ${JSON.stringify(cities)};\n\n` +
  `/** İller arası karayolu mesafesi (km), plaka koduna göre */\n` +
  `export const DISTANCES_KM: Record<string, Record<string, number>> = ${JSON.stringify(distances)};\n`;

writeFileSync(fileURLToPath(new URL('../src/data.ts', import.meta.url)), body);
console.log(`${cities.length} il, ${cities.reduce((n, c) => n + c.districts.length, 0)} ilçe yazıldı.`);
