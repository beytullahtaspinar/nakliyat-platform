/**
 * Türkiye cep telefonu numarasını +905XXXXXXXXX biçimine çevirir.
 * Geçersizse null döner. Kabul edilen örnekler: 05321234567, 5321234567, +90 532 123 45 67
 */
export function normalizeTrMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const national = digits.replace(/^(90|0)/, '');
  return /^5\d{9}$/.test(national) ? `+90${national}` : null;
}
