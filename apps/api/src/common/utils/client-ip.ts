import type { Request } from 'express';

/** Bağlantı sunucunun kendi vekilinden (LiteSpeed/Passenger) mi geliyor: döngü adresi ya da unix soketi */
const fromLocalProxy = (address: string | undefined) =>
  !address || address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.');

/**
 * Hız sınırı için istemci IP'si. Canlıda API, sunucudaki vekil arkasında çalışır; bağlantının adresi
 * her ziyaretçi için vekilin adresidir. Bu durumda X-Forwarded-For'daki SON değer alınır: onu vekil ekler,
 * ziyaretçinin kendi gönderdiği sahte değerler listenin başında kalır. Vekilsiz bağlantıda soket adresi.
 */
export function clientIpForLimit(req: Pick<Request, 'headers' | 'socket'>): string {
  const remote = req.socket?.remoteAddress;
  if (fromLocalProxy(remote)) {
    const header = req.headers['x-forwarded-for'];
    const list = (Array.isArray(header) ? header.join(',') : header ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const last = list.at(-1);
    if (last) return last.replace(/^::ffff:/, '').slice(0, 45);
  }
  return (remote ?? 'bilinmiyor').replace(/^::ffff:/, '');
}
