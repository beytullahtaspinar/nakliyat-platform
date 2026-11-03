import type { BlogImage } from "@/lib/blog/api";

/**
 * Bölge sayfasının yönetimden seçilen kapak görseli: önizleme + büyük boy (blog görselleriyle aynı).
 * Lisanslı görselde (ör. Wikimedia Commons) fotoğrafçı ve lisans görselin altında yazılır: lisans şartı.
 * Bağlantılar nofollow: atıf yükümlülüğü yerine getirilir, 81 sayfadan dış sitelere sıralama gücü aktarılmaz.
 */
export function CoverImage({ image }: { image: BlogImage }) {
  const credit = image.credit;
  return (
    <figure className="mt-8">
      {/* eslint-disable-next-line @next/next/no-img-element -- blog görselleri kendi srcset'iyle sunulur */}
      <img
        src={image.src}
        srcSet={`${image.thumb.src} ${image.thumb.width}w, ${image.src} ${image.width}w`}
        sizes="(min-width: 768px) 720px, 100vw"
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded-xl"
      />
      {credit && (
        <figcaption className="mt-2 text-xs text-zinc-600">
          Fotoğraf:{" "}
          {credit.sourceUrl ? (
            <a href={credit.sourceUrl} rel="nofollow noopener" target="_blank" className="underline hover:text-zinc-900">
              {credit.author}
            </a>
          ) : (
            credit.author
          )}
          {" · "}
          {credit.licenseUrl ? (
            <a href={credit.licenseUrl} rel="nofollow noopener license" target="_blank" className="underline hover:text-zinc-900">
              {credit.license}
            </a>
          ) : (
            credit.license
          )}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Görselin yapısal verisi (Google görsel meta verisi): oluşturan, lisans ve atıf metni.
 * Lisans bilgisi olmayan görselde yalnızca adres ve boyut verilir.
 */
export function imageObjectJsonLd(image: BlogImage, siteUrl: string) {
  const credit = image.credit;
  return {
    "@type": "ImageObject",
    contentUrl: `${siteUrl}${image.src}`,
    url: `${siteUrl}${image.src}`,
    width: image.width,
    height: image.height,
    ...(image.alt && { caption: image.alt }),
    ...(credit && {
      creator: { "@type": "Person", name: credit.author },
      creditText: credit.author,
      copyrightNotice: `${credit.author}, ${credit.license}`,
      ...(credit.licenseUrl && { license: credit.licenseUrl }),
      ...(credit.sourceUrl && { acquireLicensePage: credit.sourceUrl }),
    }),
  };
}
