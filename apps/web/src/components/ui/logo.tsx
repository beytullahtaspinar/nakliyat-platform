/* eslint-disable @next/next/no-img-element -- küçük, sabit marka görselleri (public/marka/), optimize edilecek bir şey yok */

/**
 * Marka logosu: "Evden_Eve_Nakliyat_Logo_Sunum_v2.pdf" (2026-10-14). Turuncu-mavi geçişli "e" + "Evden Eve Nakliyat"
 * ve altında "TEKLİF PLATFORMU". Sunumdaki logo 1480×331'lik bir görsel; yeniden çizilmeden beyaz zemini saydama
 * çevrilip kırpıldı. Kaynak ve betikler: /mnt/project-files/tasarim/logo/sunum-v2-2026-10-14/. Gerçek SVG gelince
 * dosyalar değiştirilir.
 * Kılavuz: küçük ölçülerde alt başlık kullanılmaz (başlıkta `logo-*.webp`, altbilgide alt başlıklı `logo-tam-*.webp`);
 * koyu zeminde beyaz kart içinde kullanılır.
 */

/** Yalnızca "e" işareti (192×138) */
export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src="/marka/e.webp" width={192} height={138} alt="" className={className} decoding="async" />;
}

/** Uygulama simgesi: sunumdaki lacivert ikon (lacivert çerçeve, beyaz iç kare, "e"); panellerde, telefon simgesiyle aynı */
export function LogoAppIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[18%] bg-brand-700 ${className}`} aria-hidden>
      <span className="flex h-[76%] w-[76%] items-center justify-center rounded-[16%] bg-white">
        <LogoMark className="h-auto w-[78%]" />
      </span>
    </span>
  );
}

/**
 * Yatay logo. Erişilebilir ad logoyu saran bağlantıdan (aria-label) ya da yanındaki metinden gelir, görsel boş alt'lıdır.
 * `full`: "TEKLİF PLATFORMU" alt başlıklı sürüm (büyük kullanımlar).
 * Başlıkta masaüstünde (lg) alt başlıklı, daha dar ekranlarda alt başlıksız logo gösterilir.
 * `compactBelow360`: çok dar telefonlarda (320 px) yalnızca "e"; başlıktaki düğmelere yer kalsın.
 */
export function Logo({ compactBelow360 = false, full = false }: { compactBelow360?: boolean; full?: boolean }) {
  if (full) {
    return (
      <img
        src="/marka/logo-tam-480.webp"
        srcSet="/marka/logo-tam-480.webp 480w, /marka/logo-tam-960.webp 960w"
        sizes="302px"
        width={480}
        height={89}
        alt=""
        decoding="async"
        className="block h-14 w-auto"
      />
    );
  }
  return (
    <picture>
      {compactBelow360 ? (
        <source media="(max-width: 359px)" srcSet="/marka/e-96.webp 96w, /marka/e.webp 192w" sizes="45px" width={192} height={138} />
      ) : null}
      <source
        media="(min-width: 1024px)"
        srcSet="/marka/logo-tam-480.webp 480w, /marka/logo-tam-960.webp 960w"
        sizes="302px"
        width={480}
        height={89}
      />
      <img
        src="/marka/logo-280.webp"
        srcSet="/marka/logo-280.webp 280w, /marka/logo-560.webp 560w, /marka/logo-840.webp 840w"
        sizes="(min-width: 640px) 238px, 173px"
        width={280}
        height={52}
        alt=""
        decoding="async"
        className="block h-8 w-auto sm:h-11 lg:h-14"
      />
    </picture>
  );
}
