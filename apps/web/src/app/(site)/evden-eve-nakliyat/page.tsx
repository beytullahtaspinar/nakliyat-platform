import type { Metadata } from "next";
import { citySlug, getCities, routeSlug } from "@nakliyat/locations";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { LinkGrid } from "@/components/local/link-grid";
import { HUB_PATH } from "@/lib/local-content";
import { LAUNCH_CITIES } from "@/lib/local-seo";

export const metadata: Metadata = {
  title: "Türkiye Geneli Evden Eve Nakliyat: 81 İl",
  description:
    "Türkiye'nin 81 ilinde evden eve ve şehirler arası nakliyat için doğrulanmış firmalardan ücretsiz teklif alın, fiyatları karşılaştırın.",
  alternates: { canonical: HUB_PATH },
};

export default function HubPage() {
  const cityLinks = getCities().map((c) => ({ href: `/${citySlug(c)}`, label: c.name }));
  const routeLinks = LAUNCH_CITIES.flatMap((from) =>
    LAUNCH_CITIES.filter((to) => to !== from).map((to) => ({
      href: `/${routeSlug(from, to)}`,
      label: `${from.name} - ${to.name}`,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: "Ana sayfa", href: "/" },
          { name: "Evden eve nakliyat", href: HUB_PATH },
        ]}
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Türkiye geneli evden eve nakliyat
      </h1>
      <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">
        Taşınacağınız ili seçin; o bölgede hizmet veren doğrulanmış nakliyat firmalarından teklif
        alın ve karşılaştırın.
      </p>
      <LinkGrid title="İller" links={cityLinks} />
      <LinkGrid title="Popüler şehirler arası güzergâhlar" links={routeLinks} />
    </main>
  );
}
