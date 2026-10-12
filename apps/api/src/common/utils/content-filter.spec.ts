import { describe, expect, it } from 'vitest';
import { hasBlockedWords } from './content-filter.js';

describe('hasBlockedWords', () => {
  it('küfür ve hakareti yakalar', () => {
    for (const text of ['Siktir git', 'sen tam bir şerefsizsin', 'AMK ne bu fiyat', 'orospu çocuğu', 'Göt herif']) {
      expect(hasBlockedWords(text), text).toBe(true);
    }
  });

  it('nakliyatta sık geçen masum sözcüklere takılmaz', () => {
    for (const text of [
      'Eşyaları yarın götürürüz',
      'Hiç sıkıntı olmadı, teşekkürler',
      'Koltukları ambalajladık',
      'Paket sayısı aqua renkli koliler',
      'Kamyonu Amasya yolundan getirdik',
      'Sikke koleksiyonu kırılmasın',
      'Ekip çok iyi, kocaman teşekkürler',
      'Ocak ayında taşındık',
    ]) {
      expect(hasBlockedWords(text), text).toBe(false);
    }
  });
});
