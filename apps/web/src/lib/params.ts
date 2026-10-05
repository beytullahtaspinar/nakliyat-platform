/** Panel listelerinin adres parametreleri (yönetim ve firma paneli) */

/** ?sayfa=3 → 3; geçersizse 1 */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
