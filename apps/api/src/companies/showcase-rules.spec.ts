import { findContactInfo, isShowcaseComplete, servicesOf } from './showcase-rules.js';

describe('tanıtım sayfası kuralları', () => {
  it.each([
    ['Bizi arayın 0532 123 45 67', 'telefon'],
    ['+90 (532) 123-45-67', 'telefon'],
    ['Sabit hat (0212) 555 12 12', 'telefon'],
    ['05321234567', 'telefon'],
    ['Yazın: bilgi@ornek-nakliyat.com', 'e-posta'],
    ['www.ornek.com adresimiz', 'web adresi'],
    ['https://ornek.net', 'web adresi'],
    ['ornek-nakliyat.com.tr', 'web adresi'],
  ])('%s → %s', (text, expected) => {
    expect(findContactInfo(text)).toBe(expected);
  });

  it.each([
    '2008 yılından beri 7/24 hizmet veriyoruz.',
    '1500 taşıma, 35 il, 12 araç, 40 kişilik ekip.',
    'Örnek Nakliyat Ltd. Şti. olarak paketleme, montaj vb. hizmetler.',
    'Fiyatlarımız 15.000 - 45.000 TL arası.',
  ])('iletişim bilgisi sayılmaz: %s', (text) => {
    expect(findContactInfo(text)).toBeNull();
  });

  it('dizine açılma: 300 karakter yazı ve 2 fotoğraf', () => {
    expect(isShowcaseComplete('a'.repeat(300), 2)).toBe(true);
    expect(isShowcaseComplete('a'.repeat(299), 5)).toBe(false);
    expect(isShowcaseComplete('a'.repeat(400), 1)).toBe(false);
    expect(isShowcaseComplete(null, 3)).toBe(false);
  });

  it('hizmetler sabit sırada, bilinmeyenler atılır', () => {
    expect(servicesOf(['MONTAJ', 'X', 'EVDEN_EVE'])).toEqual(['EVDEN_EVE', 'MONTAJ']);
    expect(servicesOf(null)).toEqual([]);
  });
});
