// Seçilen il fotoğraflarını Wikimedia Commons'tan indirir (en fazla 1920 px) ve güncel atıf bilgisini toplar.
// Ayrıca eksik kalan illerde ek aday arar. Kullanım: node indir.mjs <secilenler.json yolu>
//   -> ./il-gorsel-secilen/buyuk/<ad>.jpg, ./il-gorsel-secilen/meta.json, ./il-gorsel-secilen/ek/<il>-<n>.jpg, ek.json
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const UA = 'NakliyatPlatformImageCurator/1.0 (https://evdenevenakliyat.app; destek@evdenevenakliyat.app)';
const OUT = 'il-gorsel-secilen';
await mkdir(`${OUT}/buyuk`, { recursive: true });
await mkdir(`${OUT}/ek`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (u) => u.split('?')[0].replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/');
async function get(url) {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    console.log('bekleniyor', res.status, url.slice(0, 80));
    await sleep((Number(res.headers.get('retry-after')) || 5) * 1000 + 500);
  }
  throw new Error('başarısız: ' + url);
}
const api = async (params) =>
  (await get('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ ...params, format: 'json', formatversion: '2' }))).json();
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

const chosen = JSON.parse(await readFile(process.argv[2], 'utf8'));
const meta = [];
for (const c of chosen) {
  const data = await api({ action: 'query', titles: c.title, prop: 'imageinfo', iiprop: 'url|user|extmetadata|size', iiurlwidth: '1920' });
  const ii = data.query.pages[0].imageinfo[0];
  const m = ii.extmetadata ?? {};
  const src = ii.width > 1920 ? clean(ii.thumburl) : ii.url;
  await writeFile(`${OUT}/buyuk/${c.name}.jpg`, Buffer.from(await (await get(src)).arrayBuffer()));
  meta.push({ ...c, uploader: ii.user, artistHtml: m.Artist?.value ?? '', artist: strip(m.Artist?.value), credit: strip(m.Credit?.value),
    attribution: strip(m.Attribution?.value), license: (m.LicenseShortName?.value ?? '').trim(), licenseUrl: m.LicenseUrl?.value ?? null });
  await writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
  console.log(c.name);
}

// Eksik iller için ek aday
const EK = { kahramanmaras: ['Kahramanmaraş Kalesi', 'Kahramanmaraş'], kirsehir: ['Cacabey Medresesi', 'Kırşehir'], siirt: ['Siirt Ulu Camii', 'Botan Vadisi'] };
const OK = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( [a-z]+)?)$/i;
const ek = {};
for (const [slug, queries] of Object.entries(EK)) {
  const cands = new Map();
  for (const q of queries) {
    if (cands.size >= 4) break;
    const data = await api({ action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '50', gsrsearch: `${q} filetype:bitmap`,
      prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime|user', iiurlwidth: '500' });
    for (const pg of (data.query?.pages ?? []).sort((a, b) => a.index - b.index)) {
      const ii = pg.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
      if (!ii || cands.has(pg.title) || cands.size >= 4 || !OK.test((m.LicenseShortName?.value ?? '').trim()) || ii.mime !== 'image/jpeg') continue;
      if (ii.width < 1600 || ii.width / ii.height < 1.3 || ii.width / ii.height > 2.1 || (m.Restrictions?.value ?? '').trim()) continue;
      cands.set(pg.title, { title: pg.title, page: ii.descriptionurl, width: ii.width, height: ii.height, license: m.LicenseShortName.value.trim(),
        licenseUrl: m.LicenseUrl?.value ?? null, artist: strip(m.Artist?.value), uploader: ii.user, description: strip(m.ImageDescription?.value).slice(0, 300), thumb: clean(ii.thumburl) });
    }
  }
  ek[slug] = [...cands.values()];
  for (const [i, c] of ek[slug].entries()) await writeFile(`${OUT}/ek/${slug}-${i}.jpg`, Buffer.from(await (await get(c.thumb)).arrayBuffer()));
  await writeFile(`${OUT}/ek.json`, JSON.stringify(ek, null, 1));
  console.log('ek', slug, ek[slug].length);
}
