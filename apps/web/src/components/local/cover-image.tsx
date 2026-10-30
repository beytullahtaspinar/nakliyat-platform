import type { BlogImage } from "@/lib/blog/api";

/** Bölge sayfasının yönetimden seçilen kapak görseli: önizleme + büyük boy (blog görselleriyle aynı) */
export function CoverImage({ image }: { image: BlogImage }) {
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
    </figure>
  );
}
