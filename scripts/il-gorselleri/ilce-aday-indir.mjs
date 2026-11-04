// Dizine açık ilçe sayfaları için Wikimedia Commons'tan ilçe başına 4 aday fotoğraf (500 px) + üst veri
// Kullanım: node ilce-aday-indir.mjs ilceler.json [çıktı klasörü]  -> ./ilce-gorsel-adaylari/
// Listede "q" (arama ifadeleri) verilen ilçelerde ilçe adı yerine simge yapılar aranır.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const UA = 'NakliyatPlatformImageCurator/1.0 (https://evdenevenakliyat.app; destek@evdenevenakliyat.app)';
const OUT = process.argv[3] ?? 'ilce-gorsel-adaylari';
// Az fotoğraflı yerler için alt genişlik sınırı düşürülebilir: MIN_W=1200 node ...
const MIN_W = Number(process.env.MIN_W) || 1600;
await mkdir(`${OUT}/kucuk`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    console.log('bekleniyor', res.status);
    await sleep((Number(res.headers.get('retry-after')) || 5) * 1000 + 500);
  }
  throw new Error('başarısız: ' + url);
}
const clean = (u) => u.split('?')[0].replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/');
const OK = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( [a-z]+)?)$/i;
const BAD = /map|harita|logo|flag|bayra|seal|amblem|location|districts|locator|plan|diagram|svg|coat|sign|tabela|chart|portrait|interior|stadium|stadyum|match/i;
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const list = JSON.parse(await readFile(process.argv[2], 'utf8'));
let all = {};
try {
  all = JSON.parse(await readFile(`${OUT}/adaylar.json`, 'utf8'));
} catch {}
for (const d of list) {
  if (all[d.key]) continue;
  const cands = new Map();
  const queries = d.q ? d.q.map((q) => `${q} filetype:bitmap`) : [`"${d.ilce}" ${d.il} filetype:bitmap`, `"${d.ilce}" filetype:bitmap`];
  for (const query of queries) {
    if (cands.size >= 4) break;
    const p = new URLSearchParams({ action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '50', gsrsearch: query,
      prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime|user', iiurlwidth: '500', format: 'json', formatversion: '2' });
    const data = await (await get('https://commons.wikimedia.org/w/api.php?' + p)).json();
    for (const pg of (data.query?.pages ?? []).sort((a, b) => a.index - b.index)) {
      const ii = pg.imageinfo?.[0];
      const m = ii?.extmetadata ?? {};
      const lic = (m.LicenseShortName?.value ?? '').trim();
      if (!ii || cands.has(pg.title) || cands.size >= 4 || !OK.test(lic) || ii.mime !== 'image/jpeg') continue;
      if (ii.width < MIN_W || ii.width / ii.height < 1.3 || ii.width / ii.height > 2.1) continue;
      if (BAD.test(pg.title) || (m.Restrictions?.value ?? '').trim()) continue;
      cands.set(pg.title, { title: pg.title, page: ii.descriptionurl, width: ii.width, height: ii.height, license: lic,
        licenseUrl: m.LicenseUrl?.value ?? null, artist: strip(m.Artist?.value), uploader: ii.user,
        description: strip(m.ImageDescription?.value).slice(0, 300), thumb: clean(ii.thumburl) });
    }
  }
  all[d.key] = [...cands.values()];
  for (const [i, c] of all[d.key].entries()) {
    await writeFile(`${OUT}/kucuk/${d.key}-${i}.jpg`, Buffer.from(await (await get(c.thumb)).arrayBuffer()));
  }
  await writeFile(`${OUT}/adaylar.json`, JSON.stringify(all, null, 1));
  console.log(d.key, all[d.key].length);
}
