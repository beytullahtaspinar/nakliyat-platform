/* eslint-disable @next/next/no-img-element -- küçük, sabit rozet dosyaları (public/magaza/), optimize edilecek bir şey yok */
import { MOBILE_APPS, type MobileAppKind } from "@/lib/mobile-apps";

/**
 * Resmi mağaza rozetleri (Türkçe): Apple "App Store'dan İndirin" (Apple Marketing Tools, siyah, tr-tr) ve
 * Google "Google Play'den Alın" (Google Play badge, tr). Kılavuzlar gereği rozetler değiştirilmez, yeniden
 * renklendirilmez; iki rozet aynı yükseklikte gösterilir. Kaynak dosyalar: public/magaza/.
 *
 * Boyut: `md` 40 px (sayfa içi), `sm` 36 px (altbilgi, panel kartları). Dokunma hedefi en az 24 px.
 */
const SIZES = { sm: "h-9", md: "h-10" } as const;

export function StoreBadges({
  app,
  size = "md",
  className = "",
}: {
  app: MobileAppKind;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const a = MOBILE_APPS[app];
  const h = SIZES[size];
  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`}>
      <li>
        <a href={a.playUrl} target="_blank" rel="noopener" className="inline-block rounded-lg focus-visible:outline-offset-2">
          <img
            src="/magaza/google-play.webp"
            width={GOOGLE_W}
            height={BADGE_H}
            alt={`${a.name} uygulamasını Google Play'den alın`}
            className={`${h} w-auto`}
            loading="lazy"
            decoding="async"
          />
        </a>
      </li>
      <li>
        <a href={a.appStoreUrl} target="_blank" rel="noopener" className="inline-block rounded-lg focus-visible:outline-offset-2">
          <img
            src="/magaza/app-store.svg"
            width={APPLE_W}
            height={BADGE_H}
            alt={`${a.name} uygulamasını App Store'dan indirin`}
            className={`${h} w-auto`}
            loading="lazy"
            decoding="async"
          />
        </a>
      </li>
    </ul>
  );
}

// Dosyaların doğal oranı (yükseklik 40'a göre); yer ayrılsın, sayfa kaymasın (CLS)
const BADGE_H = 40;
const GOOGLE_W = 135;
const APPLE_W = 151;

/** Panellerde (hesabım, firma paneli) uygulama indirme kartı */
export function AppDownloadCard({ app, title, text }: { app: MobileAppKind; title: string; text: string }) {
  return (
    <section aria-labelledby={`uygulama-${app}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id={`uygulama-${app}`} className="text-base font-semibold text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
      <StoreBadges app={app} size="sm" className="mt-4" />
    </section>
  );
}
