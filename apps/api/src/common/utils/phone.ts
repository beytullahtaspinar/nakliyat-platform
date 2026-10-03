/**
 * Türkiye cep telefonu numarasını +905XXXXXXXXX biçimine çevirir.
 * Geçersizse null döner. Kabul edilen örnekler: 05321234567, 5321234567, +90 532 123 45 67
 */
export function normalizeTrMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const national = digits.replace(/^(90|0)/, '');
  return /^5\d{9}$/.test(national) ? `+90${national}` : null;
}

/** "+905321234567" → "0532 123 45 67" (bildirimlerde okunur yazım) */
export function formatTrPhone(phone: string): string {
  const m = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
