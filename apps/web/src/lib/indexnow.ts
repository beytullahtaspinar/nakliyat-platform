import { after } from "next/server";
import { SITE_URL } from "@/lib/site";

/**
 * IndexNow: yeni ya da değişen sayfayı Bing ve Yandex'e anında bildirir (ChatGPT ve Copilot aramaları Bing
 * dizinini kullanır). Anahtar gizli değildir; doğrulama için /indexnow.txt adresinde yayınlanır.
 * Yerel geliştirmede ve testlerde (INDEXNOW=kapali) istek atılmaz; testler INDEXNOW_ENDPOINT ile sahte sunucuya yollar.
 */
export const INDEXNOW_KEY = "1699a5b0cdf25b09db6d9c91b735d752";
export const INDEXNOW_KEY_PATH = "/indexnow.txt";

const ENDPOINT = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
/** Tek istekte en fazla 10.000 adres */
const BATCH = 10_000;

export const indexNowEnabled = () =>
  process.env.NODE_ENV === "production" && process.env.INDEXNOW !== "kapali";

/** Adresleri gönderir; gönderilen adres sayısını döner. Hata fırlatır (yönetimdeki "tümünü bildir" düğmesi gösterir). */
export async function submitToIndexNow(paths: string[]): Promise<number> {
  if (!indexNowEnabled()) return 0;
  const site = new URL(SITE_URL);
  const urlList = [...new Set(paths.map((p) => new URL(p, site).toString()))].filter((u) => new URL(u).host === site.host);
  for (let i = 0; i < urlList.length; i += BATCH) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key: INDEXNOW_KEY,
        keyLocation: `${site.origin}${INDEXNOW_KEY_PATH}`,
        urlList: urlList.slice(i, i + BATCH),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // 200 alındı, 202 doğrulama bekliyor; ikisi de başarılı
    if (!res.ok) throw new Error(`IndexNow ${res.status}`);
  }
  return urlList.length;
}

/** Yanıt kullanıcıya gittikten sonra arka planda bildirir; hata yalnızca loglanır */
export function notifyIndexNow(paths: string[]) {
  if (!indexNowEnabled() || paths.length === 0) return;
  after(async () => {
    try {
      await submitToIndexNow(paths);
    } catch (err) {
      console.warn("IndexNow bildirimi gönderilemedi:", (err as Error).message);
    }
  });
}
