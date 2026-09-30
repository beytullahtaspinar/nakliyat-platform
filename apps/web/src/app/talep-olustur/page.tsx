import type { Metadata } from "next";
import { getCities, getCityByCode, getDistrict } from "@nakliyat/locations";
import { getCurrentUser } from "@/lib/session";
import { turkeyDate } from "@/lib/request-options";
import { RequestForm, type CityOption } from "./request-form";

export const metadata: Metadata = {
  title: "Ücretsiz nakliyat teklifi al",
  description:
    "Taşınma bilgilerini bir kez gir, doğrulanmış nakliyat firmalarından gelen teklifleri tek ekranda karşılaştır.",
  alternates: { canonical: "/talep-olustur" },
  // Form sayfası: arama sonuçlarında il/ilçe sayfaları öne çıksın
  robots: { index: false, follow: true },
};

const cities: CityOption[] = getCities().map((c) => ({
  code: c.code,
  name: c.name,
  districts: c.districts.map((d) => ({ slug: d.slug, name: d.name })),
}));

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function CreateRequestPage({ searchParams }: PageProps<"/talep-olustur">) {
  const params = await searchParams;
  const from = getCityByCode(param(params.nereden) ?? "");
  const to = getCityByCode(param(params.nereye) ?? "");
  const districtSlug = param(params.ilce);
  const fromDistrict = from && districtSlug && getDistrict(from, districtSlug) ? districtSlug : undefined;
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Ücretsiz teklif al</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Taşınma bilgilerini bir kez gir. Bölgendeki doğrulanmış nakliyat firmaları sana teklif
        göndersin, sen karşılaştırıp seç. Teklif almak ücretsiz ve bağlayıcı değil.
      </p>
      {user && user.role !== "CUSTOMER" ? (
        <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Firma hesabıyla giriş yaptın. Taşıma talebi oluşturmak için çıkış yapıp müşteri hesabıyla
          devam et.
        </p>
      ) : (
      <div className="mt-8">
        <RequestForm
          cities={cities}
          userName={user?.fullName ?? null}
          defaults={{ fromCityCode: from?.code, fromDistrict, toCityCode: to?.code }}
          minDate={turkeyDate(1)}
          maxDate={turkeyDate(365)}
        />
      </div>
      )}
    </main>
  );
}
