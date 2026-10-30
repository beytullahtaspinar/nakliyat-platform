import { after } from "next/server";
import { SITE_URL } from "@/lib/site";

/**
 * IndexNow: yeni ya da değişen sayfayı Bing ve Yandex'e anında bildirir (ChatGPT ve Copilot aramaları Bing
 * dizinini kullanır). Anahtar gizli değildir; doğrulama için /indexnow.txt adresinde yayınlanır.
 * Yerel geliştirmede ve testlerde (INDEXNOW=kapali) istek atılmaz; testler INDEXNOW_ENDPOINT ile sahte sunucuya yollar.
 */
export const INDEXNOW_KEY = "1699a5b0cdf25b09db6d9c91b735d752";
export const INDEXNOW_KEY_PATH = "/indexnow.txt";

/** api.indexnow.org'a ulaşılamazsa aynı protokolle doğrudan Bing'e gönderilir (Bing aldığını Yandex'le paylaşır) */
const ENDPOINTS = process.env.INDEXNOW_ENDPOINT
  ? [process.env.INDEXNOW_ENDPOINT]
  : ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];
/** Tek istekte en fazla 10.000 adres */
const BATCH = 10_000;

export const indexNowEnabled = () =>
  process.env.NODE_ENV === "production" && process.env.INDEXNOW !== "kapali";

/** IndexNow'ın reddettiği istek; yönetim ekranı durum koduna göre açıklama gösterir */
export class IndexNowError extends Error {
  constructor(
    readonly status: number | null,
    readonly endpoint: string,
    detail: string,
  ) {
    super(`IndexNow ${status ?? "ağ hatası"} (${endpoint}): ${detail}`);
  }
}

/** Yönetici için Türkçe açıklama */
export function describeIndexNowError(err: unknown): string {
  if (!(err instanceof IndexNowError)) return "Bildirim gönderilemedi, biraz sonra tekrar deneyin.";
  switch (err.status) {
    case null:
      return "Sunucu Bing'in bildirim adresine ulaşamadı (bağlantı ya da zaman aşımı). Biraz sonra tekrar deneyin; sürerse barındırma firmasına giden bağlantıların açık olup olmadığını sorun.";
    case 400:
      return "Bing isteği geçersiz saydı (400).";
    case 403:
      return `Bing site anahtarını doğrulayamadı (403). ${INDEXNOW_KEY_PATH} adresinin açıldığını kontrol edin; yeni kurulumda doğrulama birkaç saat sürebilir.`;
    case 422:
      return "Bing adreslerin bu siteye ait olmadığını söyledi (422).";
    case 429:
      return "Bing çok sık bildirim yapıldığını söyledi (429). Bir gün sonra tekrar deneyin.";
    default:
      return `Bing bildirimi kabul etmedi (${err.status}). Biraz sonra tekrar deneyin.`;
  }
}

async function post(endpoint: string, body: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const cause = (err as Error & { cause?: Error }).cause;
    throw new IndexNowError(null, endpoint, [(err as Error).message, cause?.message].filter(Boolean).join(": "));
  }
  // 200 alındı, 202 doğrulama bekliyor; ikisi de başarılı
  if (!res.ok) throw new IndexNowError(res.status, endpoint, (await res.text().catch(() => "")).slice(0, 300));
}

/**
 * Adresleri gönderir; gönderilen adres sayısını döner. Hata fırlatır (yönetimdeki "tümünü bildir" düğmesi gösterir).
 * Bir adrese ulaşılamazsa ya da 5xx dönerse sıradaki adres denenir; 4xx yanıtı kesin kabul edilir.
 */
export async function submitToIndexNow(paths: string[]): Promise<number> {
  if (!indexNowEnabled()) return 0;
  const site = new URL(SITE_URL);
  const urlList = [...new Set(paths.map((p) => new URL(p, site).toString()))].filter((u) => new URL(u).host === site.host);
  for (let i = 0; i < urlList.length; i += BATCH) {
    const body = JSON.stringify({
      host: site.host,
      key: INDEXNOW_KEY,
      keyLocation: `${site.origin}${INDEXNOW_KEY_PATH}`,
      urlList: urlList.slice(i, i + BATCH),
    });
    for (const [n, endpoint] of ENDPOINTS.entries()) {
      try {
        await post(endpoint, body);
        break;
      } catch (err) {
        const retryable = err instanceof IndexNowError && (err.status === null || err.status >= 500);
        if (!retryable || n === ENDPOINTS.length - 1) throw err;
        console.warn("IndexNow:", (err as Error).message, "- sıradaki adres deneniyor");
      }
    }
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
