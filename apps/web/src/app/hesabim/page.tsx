import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterTabs, PageHeader } from "@/components/panel/panel-bits";
import { ArrowRightIcon, PlusIcon } from "@/components/ui/icons";
import { apiFetch, type MovingRequest, type Paginated, type RequestStatus, type UnreadMessages } from "@/lib/api";
import { formatDate, place } from "@/lib/format";
import { REQUEST_STATUS, homeTypeLabel } from "@/lib/request-options";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Taleplerim | Hesabım" } };

/** Aktif: firmayla süreci süren talepler; geçmiş: kapanmış olanlar */
const ACTIVE: RequestStatus[] = ["DRAFT", "OPEN", "BOOKED"];

const route = (r: MovingRequest) => `${place(r.fromCityName, r.fromDistrictName)} → ${place(r.toCityName, r.toDistrictName)}`;

export default async function AccountPage({ searchParams }: PageProps<"/hesabim">) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/hesabim");
  if (user.role !== "CUSTOMER") redirect(homeFor(user.role));

  const { yeni, durum } = await searchParams;
  const token = (await getAccessToken())!;
  const [{ items }, unread] = await Promise.all([
    apiFetch<Paginated<MovingRequest>>("/requests?limit=50", { token }),
    apiFetch<UnreadMessages>("/messages/unread", { token }),
  ]);
  const unreadFor = (requestId: string) => unread.items.find((u) => u.requestId === requestId)?.count ?? 0;

  const active = items.filter((r) => ACTIVE.includes(r.status));
  const past = items.filter((r) => !ACTIVE.includes(r.status));
  // Aktif talep yoksa geçmiş sekmesi açılır
  const showPast = durum === "gecmis" || (durum !== "aktif" && active.length === 0 && past.length > 0);
  const list = showPast ? past : active;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Merhaba ${user.fullName.split(" ")[0]}`}
        description="Taşıma taleplerin, gelen teklifler ve firmalarla yazışmaların"
        actions={
          <Link
            href="/talep-olustur"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" />
            Yeni talep
          </Link>
        }
      />

      {yeni && user.verified && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Talebin alındı. Bölgendeki doğrulanmış firmalar teklif verdikçe burada göreceksin.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <NextSteps requests={active} unreadFor={unreadFor} />
          <section aria-labelledby="talepler-baslik" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="talepler-baslik" className="text-base font-semibold text-slate-900">
                Taleplerim
              </h2>
              <FilterTabs
                label="Talep durumu"
                current={showPast ? "gecmis" : "aktif"}
                options={[
                  { value: "aktif", label: `Aktif (${active.length})`, href: "/hesabim?durum=aktif" },
                  { value: "gecmis", label: `Geçmiş (${past.length})`, href: "/hesabim?durum=gecmis" },
                ]}
              />
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
                {showPast ? "Kapanmış talebin yok." : "Şu an süren bir talebin yok."}{" "}
                <Link href="/talep-olustur" className="font-semibold text-brand-700 hover:underline">
                  Yeni talep oluştur
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {list.map((r) => (
                  <RequestCard key={r.id} request={r} unread={unreadFor(r.id)} highlighted={r.id === yeni} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Bekleyen işler: okunmamış mesaj, karşılaştırılacak teklifler, yaklaşan taşınma */
function NextSteps({ requests, unreadFor }: { requests: MovingRequest[]; unreadFor: (id: string) => number }) {
  const steps: { key: string; href: string; title: string; text: string }[] = [];
  for (const r of requests) {
    const unread = unreadFor(r.id);
    if (unread > 0) {
      steps.push({
        key: `mesaj-${r.id}`,
        href: `/hesabim/talepler/${r.id}#mesajlar`,
        title: `${unread} yeni mesaj`,
        text: `${route(r)} taşıman için firmadan`,
      });
    }
    if (r.status === "OPEN" && r.quoteCount > 0) {
      steps.push({
        key: `teklif-${r.id}`,
        href: `/hesabim/talepler/${r.id}`,
        title: `${r.quoteCount} teklif geldi, karşılaştır`,
        text: `${route(r)} · teklif toplama ${formatDate(r.expiresAt)} tarihinde biter`,
      });
    } else if (r.status === "BOOKED") {
      steps.push({
        key: `tasima-${r.id}`,
        href: `/hesabim/talepler/${r.id}`,
        title: `Taşınman ${formatDate(r.moveDate)}`,
        text: `${route(r)} · firma bilgileri ve taşınma sonrası adımlar`,
      });
    }
  }
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="siradaki-baslik" className="rounded-xl border border-accent-200 bg-accent-50 p-4 sm:p-5">
      <h2 id="siradaki-baslik" className="text-base font-semibold text-slate-900">
        Sıradaki adım
      </h2>
      <ul className="mt-3 space-y-2">
        {steps.slice(0, 3).map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-lg border border-accent-200 bg-white px-4 py-3 hover:border-accent-300"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{s.title}</span>
                <span className="block text-sm text-slate-600 sm:truncate">{s.text}</span>
              </span>
              <ArrowRightIcon className="h-5 w-5 shrink-0 text-accent-700" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestCard({ request: r, unread, highlighted }: { request: MovingRequest; unread: number; highlighted: boolean }) {
  const status = REQUEST_STATUS[r.status];
  const cta =
    r.status === "OPEN" && r.quoteCount > 0
      ? `${r.quoteCount} teklifi karşılaştır`
      : r.status === "DRAFT"
        ? "Talebi gör"
        : "Ayrıntılar";
  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${highlighted ? "border-brand-300 ring-1 ring-brand-300" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold text-slate-900">
          <Link href={`/hesabim/talepler/${r.id}`} className="hover:underline">
            {route(r)}
          </Link>
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {homeTypeLabel(r.homeType)} · {formatDate(r.moveDate)}
        {r.estimatedVolumeM3 ? ` · yaklaşık ${r.estimatedVolumeM3} m³` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {r.status === "OPEN" && r.quoteCount === 0 ? (
          <span className="text-slate-500">Henüz teklif yok · teklif toplama {formatDate(r.expiresAt)} tarihinde biter</span>
        ) : (
          <Link href={`/hesabim/talepler/${r.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            {cta}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
        {unread > 0 && (
          <Link
            href={`/hesabim/talepler/${r.id}#mesajlar`}
            className="inline-flex rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-900 hover:underline"
          >
            {unread} yeni mesaj
          </Link>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  const steps = [
    ["Talebini oluştur", "Nereden nereye, ne zaman taşınacağını yaz. 2 dakika sürer, ücretsiz."],
    ["Teklifleri karşılaştır", "Bölgendeki doğrulanmış firmalar fiyat verir; yorum ve puanlarını gör."],
    ["Firmanı seç", "Beğendiğin teklifi kabul et, firmayla buradan yazış."],
  ];
  return (
    <section aria-labelledby="bos-baslik" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="bos-baslik" className="text-lg font-semibold text-slate-900">
        Henüz talebin yok
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3 sm:block">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">
              {i + 1}
            </span>
            <span className="sm:mt-2 sm:block">
              <span className="block font-medium text-slate-900">{title}</span>
              <span className="block text-sm text-slate-600">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link
        href="/talep-olustur"
        className="mt-6 inline-block rounded-lg bg-accent-500 px-5 py-2.5 font-semibold text-slate-900 hover:bg-accent-400"
      >
        Hemen ücretsiz teklif al
      </Link>
    </section>
  );
}
