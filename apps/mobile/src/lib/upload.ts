import type { UploadTicket } from '@nakliyat/api-client';

/** Telefondaki dosyanın baytları (file:// ya da content:// adresi) */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error('Dosya okunamadı, tekrar seç.');
  return res.arrayBuffer();
}

/**
 * Baytları yükleme adresine gönderir. Blob gönderilmez: expo/fetch blob gövdesinde Content-Type'ı blob türüyle
 * değiştirir ve Android'de yerel dosyadan okunan blob'un türü boş gelir; API türü birebir karşılaştırdığı için
 * yükleme reddedilir. ArrayBuffer'da başlık olduğu gibi gider, boyut da birebir tutar.
 */
export async function putBytes(ticket: UploadTicket, bytes: ArrayBuffer): Promise<boolean> {
  const res = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: bytes }).catch(() => null);
  return res?.ok ?? false;
}
