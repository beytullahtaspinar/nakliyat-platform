import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { HUB_PATH } from "@/lib/local-content";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Aradığın sayfa bulunamadı</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Adres yanlış yazılmış ya da sayfa taşınmış olabilir. Taşınman için teklif almaya buradan devam
        edebilir veya şehrindeki nakliyat sayfasına göz atabilirsin.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/talep-olustur">Ücretsiz teklif al</ButtonLink>
        <ButtonLink href={HUB_PATH} variant="secondary">
          Şehrini seç
        </ButtonLink>
      </div>
    </main>
  );
}
