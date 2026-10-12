import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Mesaj, yorum ve firma yanıtında açık küfür ve hakaret süzgeci (App Store 1.2 ve Google Play kullanıcı içeriği
 * kuralı: uygunsuz içerik yayınlanmadan süzülmeli). Kaba bir ilk eleme: geri kalanı kullanıcıların bildirimi ve
 * yöneticinin /yonetim/sikayetler incelemesiyle yakalanır.
 *
 * Kelimeler sözcük başında aranır; "götür", "sıkıntı", "sikke" gibi masum sözcükler takılmasın diye kökler
 * dar tutuldu ve ı/i ayrımı korunur.
 */
const BLOCKED = [
  'amk',
  'aq',
  'amına',
  'amina',
  'amcık',
  'amcik',
  'orospu',
  'siktir',
  'sikerim',
  'sikeyim',
  'sikik',
  'sikiş',
  'yarrak',
  'yarak',
  'pezevenk',
  'kahpe',
  'gavat',
  'ibne',
  'piç',
  'oç',
  'göt',
  'götveren',
  'şerefsiz',
];

// Kelimenin önü harf olmamalı (sözcük başı). Kısa olanlar tek başına kelime olmalı; uzunlar ek alabilir.
const LETTER = 'a-zçğıöşüâîû0-9';
const SHORT = BLOCKED.filter((w) => w.length <= 4);
const LONG = BLOCKED.filter((w) => w.length > 4);
const PATTERN = new RegExp(
  `(?:^|[^${LETTER}])(?:(?:${SHORT.join('|')})(?![${LETTER}])|(?:${LONG.join('|')}))`,
  'u',
);

export function hasBlockedWords(text: string): boolean {
  return PATTERN.test(text.toLocaleLowerCase('tr-TR'));
}

export const BLOCKED_WORDS_MESSAGE = 'Metinde uygunsuz bir ifade var. Lütfen düzeltip tekrar dene.';

/** class-validator: metin süzgeçten geçmeli */
export function IsCleanText(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isCleanText',
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !hasBlockedWords(value),
        defaultMessage: () => BLOCKED_WORDS_MESSAGE,
      },
    },
    options,
  );
}
