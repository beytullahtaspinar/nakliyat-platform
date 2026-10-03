/**
 * Tarayıcı tarafı PWA yardımcıları: servis işçisi, ana ekrana kurulum ve anlık bildirim aboneliği.
 * Yalnızca istemci bileşenlerinden çağrılır.
 */

export const SW_PATH = "/sw.js";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Ana ekrandan (uygulama olarak) mı açıldı? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad: anlık bildirim ancak siteyi Ana Ekrana ekledikten sonra (iOS 16.4+) çalışır */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/", updateViaCache: "none" });
}

/** Bu cihazda bildirim açılıp kapatılınca yayılan olay (ör. çıkış formu güncel aboneliği bilsin) */
export const PUSH_CHANGE_EVENT = "nk-push-change";
export const announcePushChange = () => window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** İzin ister ve bu cihazı push servisine abone eder. İzin verilmezse null. */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const registration = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  await navigator.serviceWorker.ready;
  const existing = await registration!.pushManager.getSubscription();
  const key = base64UrlToBytes(publicKey);
  // Sunucu anahtarı değiştiyse eski abonelik çalışmaz: yenisi alınır
  const sameKey =
    existing?.options.applicationServerKey &&
    new Uint8Array(existing.options.applicationServerKey).every((b, i) => b === key[i]);
  if (existing && sameKey) return existing;
  await existing?.unsubscribe();
  return registration!.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Sunucuya gönderilecek abonelik bilgisi */
export function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } };
}

// ─── Ana ekrana kurulum isteği (Chrome/Android, Edge, Samsung Internet) ───

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Tarayıcının kendi küçük çubuğu yerine panelde "Telefona kur" düğmesi gösterilir
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export const installPromptStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => deferredPrompt,
  getServer: () => null,
  async prompt() {
    const event = deferredPrompt;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferredPrompt = null;
    emit();
    return outcome === "accepted";
  },
};

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Bu cihazın kurulum ve anlık bildirim durumu (ayarlar ekranı ve panel hatırlatması için) */
export async function detectDevice() {
  const standalone = isStandalone();
  const ios = isIos();
  let push: PushState;
  let subscription: PushSubscription | null = null;
  if (!pushSupported()) push = ios && !standalone ? "ios-install" : "unsupported";
  else if (Notification.permission === "denied") push = "denied";
  else {
    subscription = await currentPushSubscription().catch(() => null);
    push = subscription && Notification.permission === "granted" ? "on" : "off";
  }
  return { standalone, ios, push, subscription };
}
