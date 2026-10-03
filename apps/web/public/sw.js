/*
 * evdenevenakliyat.app servis işçisi (service worker).
 * - Anlık bildirimleri (Web Push) gösterir, dokununca ilgili sayfayı açar.
 * - Bağlantı yokken sayfa açılmaya çalışılırsa /cevrimdisi.html gösterir.
 * Sayfaları önbelleğe almaz: içerik her zaman sunucudan gelir, eski sürüm gösterme riski yok.
 *
 * Bu dosya değişince SURUM'ü artır: tarayıcı yeni sürümü kurar ve çevrimdışı sayfayı yeniler.
 */
const SURUM = "1";
const ONBELLEK = `cevrimdisi-${SURUM}`;
const CEVRIMDISI = "/cevrimdisi.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ONBELLEK)
      .then((cache) => cache.add(new Request(CEVRIMDISI, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== ONBELLEK).map((k) => caches.delete(k)));
      // Sayfa açılırken ağ isteği servis işçisinin uyanmasını beklemesin
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        return preloaded || (await fetch(event.request));
      } catch {
        return (await caches.match(CEVRIMDISI)) || Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "evdenevenakliyat.app";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/simgeler/simge-192.png",
      badge: "/simgeler/rozet-96.png",
      lang: "tr",
      tag: data.tag,
      // Aynı etiketli yeni bildirim (ör. aynı konuşmadan yeni mesaj) yine titreşsin
      renotify: Boolean(data.tag),
      data: { path: data.path || "/uygulama" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/uygulama";
  // Yalnızca site içi yollar: bildirim içeriği başka siteye yönlendiremez
  const url = new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/uygulama", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Uygulama zaten açıksa yeni pencere açmak yerine onu ilgili sayfaya götür
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Tarayıcı aboneliği kendiliğinden yenilediğinde (nadir) kullanıcı ayarlar sayfasını açınca yeniden kaydedilir.
