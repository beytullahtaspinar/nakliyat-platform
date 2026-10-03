"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendTestPush, subscribePush, unsubscribePush } from "@/lib/actions/push";
import {
  announcePushChange,
  currentPushSubscription,
  detectDevice,
  installPromptStore,
  isStandalone,
  subscribeThisDevice,
  type PushState,
  subscriptionPayload,
} from "@/lib/pwa";

type Notice = { tone: "ok" | "error"; text: string } | null;

/**
 * "Uygulama ve anlık bildirimler" bölümü: siteyi telefona uygulama gibi kurma ve bu cihazda
 * anlık bildirimi açma/kapama. Tarayıcı özelliklerine bağlı olduğu için tamamen istemcide çalışır.
 */
export function AppAndPush({
  publicKey,
  devices,
  impersonating,
}: {
  /** API'nin VAPID açık anahtarı; null ise anlık bildirim sunucuda kapalı */
  publicKey: string | null;
  /** Hesapta bildirimi açık cihaz sayısı */
  devices: number;
  impersonating: boolean;
}) {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [push, setPush] = useState<PushState | "checking">("checking");
  const [deviceCount, setDeviceCount] = useState(devices);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const installPrompt = useSyncExternalStore(installPromptStore.subscribe, installPromptStore.get, installPromptStore.getServer);

  useEffect(() => {
    void detectDevice().then(async (device) => {
      setStandalone(device.standalone);
      setIos(device.ios);
      setPush(device.push);
      // Sunucudaki kayıt silinmiş olabilir (ör. bu telefonda başka hesap açıldı): yeniden kaydet
      if (device.subscription && device.push === "on" && publicKey && !impersonating) {
        await subscribePush(subscriptionPayload(device.subscription));
      }
    });
  }, [publicKey, impersonating]);

  const enable = () =>
    startTransition(async () => {
      setNotice(null);
      if (!publicKey) return;
      try {
        const subscription = await subscribeThisDevice(publicKey);
        if (!subscription) {
          setPush(Notification.permission === "denied" ? "denied" : "off");
          return;
        }
        const result = await subscribePush(subscriptionPayload(subscription));
        if (result.error) {
          setNotice({ tone: "error", text: result.error });
          return;
        }
        setPush("on");
        announcePushChange();
        setDeviceCount((n) => n + 1);
        setNotice({ tone: "ok", text: "Bu cihazda bildirimler açıldı. Deneme bildirimi göndererek kontrol edebilirsin." });
      } catch {
        setNotice({ tone: "error", text: "Bildirimler açılamadı. Sayfayı yenileyip tekrar dene." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      setNotice(null);
      const subscription = await currentPushSubscription().catch(() => null);
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setPush("off");
      announcePushChange();
      setDeviceCount((n) => Math.max(0, n - 1));
      setNotice({ tone: "ok", text: "Bu cihazda bildirimler kapatıldı." });
    });

  const test = () =>
    startTransition(async () => {
      setNotice(null);
      const result = await sendTestPush();
      setNotice(
        result.error
          ? { tone: "error", text: result.error }
          : result.sent
            ? { tone: "ok", text: "Deneme bildirimi gönderildi, birkaç saniye içinde gelmeli." }
            : { tone: "error", text: "Deneme bildirimi gönderilemedi. Bildirimleri kapatıp yeniden açmayı dene." },
      );
    });

  return (
    <div className="space-y-6">
      <section aria-labelledby="uygulama-kur">
        <h3 id="uygulama-kur" className="font-medium text-zinc-900">
          Telefona uygulama olarak kur
        </h3>
        {standalone ? (
          <p className="mt-1 text-sm text-green-800">✓ Şu an uygulama olarak kullanıyorsun.</p>
        ) : installPrompt ? (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              Ana ekranına simge eklenir; tek dokunuşla, tarayıcı çubuğu olmadan açılır.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => void installPromptStore.prompt().then((ok) => ok && setStandalone(isStandalone()))}
            >
              Ana ekrana ekle
            </Button>
          </>
        ) : ios ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Bu sayfayı <strong>Safari</strong> ile aç.</li>
            <li>
              Alttaki <strong>Paylaş</strong> düğmesine dokun (yukarı oklu kare).
            </li>
            <li>
              <strong>Ana Ekrana Ekle</strong>&apos;yi seçip <strong>Ekle</strong>&apos;ye dokun.
            </li>
            <li>Ana ekrandaki simgeden açıp bildirimleri aşağıdan aç.</li>
          </ol>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">
            Telefonunda tarayıcı menüsünden (⋮) <strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong>
            &apos;yi seç.
          </p>
        )}
      </section>

      {publicKey && (
        <section aria-labelledby="anlik-bildirim" className="border-t border-zinc-200 pt-5">
          <h3 id="anlik-bildirim" className="font-medium text-zinc-900">
            Bu cihazda anlık bildirim
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            Site kapalıyken de yeni talep, teklif kabulü ve mesajlar telefonuna bildirim olarak gelir.
            {deviceCount > 0 && ` Hesabında ${deviceCount} cihazda açık.`}
          </p>
          <div className="mt-3">
            {impersonating ? (
              <p className="text-sm text-zinc-600">Firma görünümündeyken bu cihaz için bildirim açılamaz.</p>
            ) : push === "checking" ? (
              <p className="text-sm text-zinc-500">Kontrol ediliyor…</p>
            ) : push === "unsupported" ? (
              <p className="text-sm text-zinc-600">Bu tarayıcı anlık bildirimi desteklemiyor. Chrome, Edge, Firefox ya da Safari ile dene.</p>
            ) : push === "ios-install" ? (
              <p className="text-sm text-zinc-600">
                iPhone&apos;da bildirim için önce siteyi yukarıdaki adımlarla ana ekrana ekle, sonra uygulamayı açıp bu sayfaya gel.
              </p>
            ) : push === "denied" ? (
              <p className="text-sm text-amber-900">
                Bu site için bildirim izni kapalı. Tarayıcının ya da telefonun ayarlarından evdenevenakliyat.app için
                bildirimlere izin verip sayfayı yenile.
              </p>
            ) : push === "on" ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-green-800">✓ Açık</span>
                <Button type="button" size="sm" variant="secondary" onClick={test} disabled={pending}>
                  Deneme bildirimi gönder
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={disable} disabled={pending}>
                  Kapat
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" onClick={enable} disabled={pending}>
                {pending ? "Açılıyor…" : "Bu cihazda bildirimleri aç"}
              </Button>
            )}
          </div>
          {notice && (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"
              }`}
            >
              {notice.text}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
