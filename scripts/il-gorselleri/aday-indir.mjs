// Wikimedia Commons'tan il başına 4 aday fotoğraf: üst veri + 500 px küçük resim
// Kullanım: node aday-indir.mjs  -> ./il-gorsel-adaylari/ klasörü
import { mkdir, writeFile } from 'node:fs/promises';
const UA = 'NakliyatPlatformImageCurator/1.0 (https://evdenevenakliyat.app; destek@evdenevenakliyat.app)';
const SIM = {"adana": "Taşköprü Adana", "adiyaman": "Nemrut Dağı", "afyonkarahisar": "Afyonkarahisar Kalesi", "agri": "İshak Paşa Sarayı", "aksaray": "Ihlara Vadisi", "amasya": "Amasya Yeşilırmak", "ankara": "Anıtkabir", "antalya": "Kaleiçi Antalya", "ardahan": "Ardahan", "artvin": "Şavşat Karagöl", "aydin": "Aphrodisias", "balikesir": "Ayvalık", "bartin": "Amasra", "batman": "Hasankeyf", "bayburt": "Bayburt Kalesi", "bilecik": "Bilecik", "bingol": "Bingöl", "bitlis": "Ahlat", "bolu": "Abant Gölü", "burdur": "Salda Gölü", "bursa": "Cumalıkızık", "canakkale": "Çanakkale Şehitleri Anıtı", "cankiri": "Çankırı", "corum": "Hattuşa", "denizli": "Pamukkale", "diyarbakir": "Diyarbakır Surları", "duzce": "Düzce", "edirne": "Selimiye Camii Edirne", "elazig": "Harput", "erzincan": "Kemaliye", "erzurum": "Erzurum Double Minaret Madrasa", "eskisehir": "Odunpazarı", "gaziantep": "Gaziantep Kalesi", "giresun": "Giresun", "gumushane": "Gümüşhane", "hakkari": "Hakkari", "hatay": "Hatay Antakya", "igdir": "Iğdır", "isparta": "Eğirdir", "istanbul": "Galata Kulesi", "izmir": "Konak Clock Tower Izmir", "kahramanmaras": "Kahramanmaraş", "karabuk": "Safranbolu", "karaman": "Karaman", "kars": "Ani", "kastamonu": "Kastamonu", "kayseri": "Erciyes", "kilis": "Kilis", "kirikkale": "Kırıkkale", "kirklareli": "Kırklareli", "kirsehir": "Kırşehir", "kocaeli": "İzmit", "konya": "Mevlana Müzesi", "kutahya": "Kütahya", "malatya": "Malatya", "manisa": "Manisa", "mardin": "Mardin", "mersin": "Kızkalesi", "mugla": "Bodrum Kalesi", "mus": "Muş", "nevsehir": "Uçhisar", "nigde": "Niğde", "ordu": "Ordu", "osmaniye": "Osmaniye", "rize": "Ayder", "sakarya": "Sapanca", "samsun": "Samsun", "sanliurfa": "Balıklıgöl", "siirt": "Siirt", "sinop": "Sinop", "sirnak": "Şırnak", "sivas": "Gök Medrese Sivas", "tekirdag": "Tekirdağ", "tokat": "Tokat", "trabzon": "Sümela", "tunceli": "Munzur", "van": "Akdamar", "yalova": "Yalova Turkey", "yozgat": "Yozgat", "zonguldak": "Zonguldak"};
const NAMES = {"adana": "Adana", "adiyaman": "Adıyaman", "afyonkarahisar": "Afyonkarahisar", "agri": "Ağrı", "aksaray": "Aksaray", "amasya": "Amasya", "ankara": "Ankara", "antalya": "Antalya", "ardahan": "Ardahan", "artvin": "Artvin", "aydin": "Aydın", "balikesir": "Balıkesir", "bartin": "Bartın", "batman": "Batman", "bayburt": "Bayburt", "bilecik": "Bilecik", "bingol": "Bingöl", "bitlis": "Bitlis", "bolu": "Bolu", "burdur": "Burdur", "bursa": "Bursa", "canakkale": "Çanakkale", "cankiri": "Çankırı", "corum": "Çorum", "denizli": "Denizli", "diyarbakir": "Diyarbakır", "duzce": "Düzce", "edirne": "Edirne", "elazig": "Elazığ", "erzincan": "Erzincan", "erzurum": "Erzurum", "eskisehir": "Eskişehir", "gaziantep": "Gaziantep", "giresun": "Giresun", "gumushane": "Gümüşhane", "hakkari": "Hakkari", "hatay": "Hatay", "igdir": "Iğdır", "isparta": "Isparta", "istanbul": "İstanbul", "izmir": "İzmir", "kahramanmaras": "Kahramanmaraş", "karabuk": "Karabük", "karaman": "Karaman", "kars": "Kars", "kastamonu": "Kastamonu", "kayseri": "Kayseri", "kirikkale": "Kırıkkale", "kirklareli": "Kırklareli", "kirsehir": "Kırşehir", "kilis": "Kilis", "kocaeli": "Kocaeli", "konya": "Konya", "kutahya": "Kütahya", "malatya": "Malatya", "manisa": "Manisa", "mardin": "Mardin", "mersin": "Mersin", "mugla": "Muğla", "mus": "Muş", "nevsehir": "Nevşehir", "nigde": "Niğde", "ordu": "Ordu", "osmaniye": "Osmaniye", "rize": "Rize", "sakarya": "Sakarya", "samsun": "Samsun", "siirt": "Siirt", "sinop": "Sinop", "sivas": "Sivas", "sanliurfa": "Şanlıurfa", "sirnak": "Şırnak", "tekirdag": "Tekirdağ", "tokat": "Tokat", "trabzon": "Trabzon", "tunceli": "Tunceli", "usak": "Uşak", "van": "Van", "yalova": "Yalova", "yozgat": "Yozgat", "zonguldak": "Zonguldak"};
const OUT = 'il-gorsel-adaylari';
await mkdir(`${OUT}/kucuk`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    await sleep((Number(res.headers.get('retry-after')) || 5) * 1000 + 500);
  }
  throw new Error('başarısız: ' + url);
}
const OK = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( [a-z]+)?)$/i;
const BAD = /map|harita|logo|flag|bayra|seal|amblem|location|districts|locator|plan|diagram|svg|coat|sign|tabela|chart|portrait|interior|panoramio/i;
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
const all = {};
for (const [slug, q] of Object.entries(SIM)) {
  const cands = new Map();
  for (const query of [`${q} filetype:bitmap`, `${NAMES[slug]} filetype:bitmap`]) {
    if (cands.size >= 4) break;
    const p = new URLSearchParams({ action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '50', gsrsearch: query,
      prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', format: 'json', formatversion: '2' });
    const data = await (await get('https://commons.wikimedia.org/w/api.php?' + p)).json();
    const pages = (data.query?.pages ?? []).sort((a, b) => a.index - b.index);
    for (const pg of pages) {
      const ii = pg.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
      const lic = (m.LicenseShortName?.value ?? '').trim();
      if (!ii || cands.has(pg.title) || !OK.test(lic) || ii.mime !== 'image/jpeg') continue;
      if (ii.width < 1920 || ii.width / ii.height < 1.3 || ii.width / ii.height > 2.1) continue;
      if (BAD.test(pg.title) || (m.Restrictions?.value ?? '').trim()) continue;
      const cats = m.Categories?.value ?? '';
      const score = (cats.includes('Quality images') ? 5 : 0) + (/Featured|Valued/.test(cats) ? 3 : 0);
      cands.set(pg.title, { title: pg.title, url: ii.url, page: ii.descriptionurl, width: ii.width, height: ii.height, license: lic,
        licenseUrl: m.LicenseUrl?.value ?? null, artist: strip(m.Artist?.value), description: strip(m.ImageDescription?.value).slice(0, 300), score });
    }
  }
  const top = [...cands.values()].sort((a, b) => b.score - a.score).slice(0, 4);
  for (const [i, c] of top.entries()) {
    // Standart küçük resim adresi: .../thumb/x/xy/Ad.jpg/500px-Ad.jpg
    const parts = c.url.split('?')[0].split('/commons/')[1];
    const file = parts.split('/').pop();
    const thumb = `https://upload.wikimedia.org/wikipedia/commons/thumb/${parts}/500px-${file}`;
    await writeFile(`${OUT}/kucuk/${slug}-${i}.jpg`, Buffer.from(await (await get(thumb)).arrayBuffer()));
  }
  all[slug] = top;
  await writeFile(`${OUT}/adaylar.json`, JSON.stringify(all, null, 1));
  console.log(slug, top.length);
}
