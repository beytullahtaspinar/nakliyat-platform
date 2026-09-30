import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch, type MovingRequest, type Paginated, type RequestStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Hesabım",
  robots: { index: false, follow: false },
};

const STATUS: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT: { label: "Taslak", className: "bg-zinc-100 text-zinc-700" },
  OPEN: { label: "Teklif bekliyor", className: "bg-blue-50 text-blue-800" },
  BOOKED: { label: "Firma seçildi", className: "bg-green-50 text-green-800" },
  COMPLETED: { label: "Tamamlandı", className: "bg-green-50 text-green-800" },
  CANCELLED: { label: "İptal edildi", className: "bg-zinc-100 text-zinc-600" },
  EXPIRED: { label: "Süresi doldu", className: "bg-zinc-100 text-zinc-600" },
};

const place = (city: string | null, district: string | null) =>
  [district, city].filter(Boolean).join(", ");

export default async function AccountPage({ searchParams }: PageProps<"/hesabim">) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/hesabim");
  if (user.role !== "CUSTOMER") redirect(homeFor(user.role));

  const { yeni } = await searchParams;
  const token = (await getAccessToken())!;
  const { items } = await apiFetch<Paginated<MovingRequest>>("/requests?limit=50", { token });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merhaba {user.fullName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Taşıma taleplerin ve gelen teklifler</p>
        </div>
        <Link
          href="/talep-olustur"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Yeni talep
        </Link>
      </div>

      {yeni && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          Talebin alındı. Bölgendeki doğrulanmış firmalar teklif verdikçe burada göreceksin.
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-zinc-600 dark:text-zinc-400">
          Henüz talebin yok.{" "}
          <Link href="/talep-olustur" className="font-medium text-blue-700 hover:underline">
            Hemen ücretsiz teklif al
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((r) => {
            const status = STATUS[r.status];
            return (
              <li
                key={r.id}
                className={`rounded-xl border p-4 ${
                  r.id === yeni ? "border-blue-300 dark:border-blue-800" : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {place(r.fromCityName, r.fromDistrictName)} → {place(r.toCityName, r.toDistrictName)}
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {homeTypeLabel(r.homeType)} · {formatDate(r.moveDate)}
                  {r.estimatedVolumeM3 ? ` · yaklaşık ${r.estimatedVolumeM3} m³` : ""}
                </p>
                <p className="mt-2 text-sm">
                  {r.quoteCount > 0 ? (
                    <strong>{r.quoteCount} teklif geldi</strong>
                  ) : (
                    <span className="text-zinc-500">Henüz teklif yok</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
