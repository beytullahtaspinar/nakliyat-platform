"""
Seçilen il fotoğraflarını sitede kullanılacak biçime çevirir ve manifest.json'u yazar.
  python3 donustur.py <il-gorsel-secilen klasörü> <meta.json> <apps/api/il-kapaklari>
- 3:2 oranına ortadan kırpılır; 1440x960 ve 800x533 WebP, üst veri (EXIF, konum) silinir.
- Atıf: fotoğrafçı, lisans, lisans adresi ve Commons sayfası (lisans şartı).
"""
import json, re, sys
from pathlib import Path
from PIL import Image

src, meta_path, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
meta = json.loads(meta_path.read_text(encoding='utf-8'))

# Commons'taki ham yazar alanı bazen e-posta, "User:" öneki ya da uzun not içerir; sitede görünecek ad
AUTHOR_FIX = {
    'adana-taskopru-seyhan-nehri': 'sevimaltnbag (Panoramio)',
    'nevsehir-kapadokya-uchisar-kalesi': 'Wolfgang Moroder',
}

def author(m):
    if m['name'] in AUTHOR_FIX:
        return AUTHOR_FIX[m['name']]
    a = re.sub(r'^User:', '', m['artist']).strip()
    if not a or '@' in a or len(a) > 60:
        a = m['uploader']
    return a

def license_label(lic):
    return 'Kamu malı' if lic.lower() == 'public domain' else lic

# Kenarında çerçeve olan fotoğraflar: kırpmadan önce kenarlardan bu oranda içeri girilir
INSET = {'kayseri-burunguz-camii-erciyes-dagi': 0.03}

def crop_3_2(im, inset=0.0):
    if inset:
        w, h = im.size; dx, dy = round(w * inset), round(h * inset)
        im = im.crop((dx, dy, w - dx, h - dy))
    w, h = im.size
    if w / h > 1.5:
        nw = round(h * 1.5); left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = round(w / 1.5); top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))

manifest = []
for m in meta:
    im = Image.open(src / 'buyuk' / f"{m['name']}.jpg").convert('RGB')
    im = crop_3_2(im, INSET.get(m['name'], 0.0))
    big = im.resize((1440, 960), Image.LANCZOS)
    small = im.resize((800, 533), Image.LANCZOS)
    big.save(out / f"{m['name']}.webp", 'WEBP', quality=55, method=6)
    small.save(out / f"{m['name']}-800.webp", 'WEBP', quality=58, method=6)
    manifest.append({
        'slug': m['slug'], 'name': m['name'], 'width': 1440, 'height': 960, 'thumbWidth': 800, 'thumbHeight': 533,
        'alt': m['alt'],
        'credit': {'author': author(m), 'license': license_label(m['license']), 'licenseUrl': m.get('licenseUrl') or None, 'sourceUrl': m['page']},
    })
manifest.sort(key=lambda e: e['slug'])
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(len(manifest), 'görsel')
