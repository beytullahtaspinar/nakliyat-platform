// Seçilen ilçe fotoğraflarını Wikimedia Commons'tan indirir (en fazla 1920 px) ve güncel atıf bilgisini toplar.
// Kullanım: node ilce-indir.mjs <ilce-secilenler.json> [çıktı klasörü]
//   -> <klasör>/buyuk/<ad>.jpg ve <klasör>/meta.json (yarıda kalırsa kaldığı yerden sürer)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const UA = 'NakliyatPlatformImageCurator/1.0 (https://evdenevenakliyat.app; destek@evdenevenakliyat.app)';
const OUT = process.argv[3] ?? 'ilce-gorsel-secilen';
await mkdir(`${OUT}/buyuk`, { recursive: true });
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
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const chosen = JSON.parse(await readFile(process.argv[2], 'utf8'));
let meta = [];
try {
  meta = JSON.parse(await readFile(`${OUT}/meta.json`, 'utf8'));
} catch {}
const done = new Set(meta.map((m) => m.name));
for (const c of chosen) {
  if (done.has(c.name)) continue;
  const p = new URLSearchParams({ action: 'query', titles: c.title, prop: 'imageinfo', iiprop: 'url|user|extmetadata|size', iiurlwidth: '1920', format: 'json', formatversion: '2' });
  const ii = (await (await get('https://commons.wikimedia.org/w/api.php?' + p)).json()).query.pages[0].imageinfo[0];
  const m = ii.extmetadata ?? {};
  const src = ii.width > 1920 ? clean(ii.thumburl) : ii.url;
  await writeFile(`${OUT}/buyuk/${c.name}.jpg`, Buffer.from(await (await get(src)).arrayBuffer()));
  meta.push({ ...c, uploader: ii.user, artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), attribution: strip(m.Attribution?.value),
    license: (m.LicenseShortName?.value ?? '').trim(), licenseUrl: m.LicenseUrl?.value ?? null });
  await writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
  console.log(c.name);
}
