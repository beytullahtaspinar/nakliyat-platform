import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/card";
import { apiFetch, type CompanyCalendar } from "@/lib/api";
import {
  addDays,
  formatDayTitle,
  formatMonth,
  formatShortDay,
  monthGrid,
  parseMonth,
  parseWeek,
  shiftMonth,
  todayInTurkey,
  WEEKDAYS_SHORT,
  weekDays,
} from "@/lib/calendar";
import { getCompanyContext } from "@/lib/company";
import { formatMoney } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";

export const metadata: Metadata = { title: "Takvim" };

type Job = CompanyCalendar["items"][number];

const city = (p: Job["from"]) => p.districtName ?? p.cityName ?? "";
const routeShort = (j: Job) =>
  j.from.cityName === j.to.cityName ? `${city(j.from)} → ${city(j.to)}` : `${j.from.cityName} → ${j.to.cityName}`;
const chipTone = {
  SCHEDULED: "border-brand-200 bg-brand-50 text-brand-900",
  COMPLETED: "border-green-200 bg-green-50 text-green-900",
  CANCELLED: "border-zinc-200 bg-zinc-50 text-zinc-500 line-through",
} as const;
const STATUS = {
  SCHEDULED: { label: "Planlandı", tone: "brand" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "neutral" },
} as const;

export default async function CompanyCalendarPage({ searchParams }: PageProps<"/firma-paneli/takvim">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const today = todayInTurkey();
  const weekView = params.gorunum === "hafta";

  const month = parseMonth(params.ay, today);
  const monday = parseWeek(params.hafta, today);
  const days = weekView ? weekDays(monday) : monthGrid(month);
  const { items } = await apiFetch<CompanyCalendar>(
    `/company/bookings/calendar?from=${days[0]}&to=${days.at(-1)}`,
    { token },
  );
  const byDay = new Map<string, Job[]>();
  for (const job of items) byDay.set(job.day, [...(byDay.get(job.day) ?? []), job]);

  const title = weekView ? `${formatShortDay(monday)} – ${formatShortDay(addDays(monday, 6))}` : formatMonth(month);
  const base = "/firma-paneli/takvim";
  const prev = weekView ? `${base}?gorunum=hafta&hafta=${addDays(monday, -7)}` : `${base}?ay=${shiftMonth(month, -1)}`;
  const next = weekView ? `${base}?gorunum=hafta&hafta=${addDays(monday, 7)}` : `${base}?ay=${shiftMonth(month, 1)}`;
  const current = weekView ? `${base}?gorunum=hafta` : base;
  // Listede gösterilecek işler: ay görünümünde yalnızca o ayın günleri
  const listed = items.filter((j) => weekView || j.day.startsWith(month));
  const upcoming = listed.filter((j) => j.status === "SCHEDULED" && j.day >= today).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold capitalize">{title}</h2>
          <p className="text-sm text-zinc-600">
            {listed.length === 0
              ? "Bu dönemde iş yok."
              : `${listed.length} iş${upcoming > 0 ? ` (${upcoming} yaklaşan)` : ""}. Taşınmadan bir gün önce sana ve müşteriye hatırlatma gider.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <nav aria-label="Görünüm" className="flex rounded-lg border border-zinc-200 p-0.5">
            <ViewLink href={weekView ? `${base}?ay=${monday.slice(0, 7)}` : base} active={!weekView} label="Ay" />
            <ViewLink
              href={`${base}?gorunum=hafta&hafta=${weekView ? monday : month === today.slice(0, 7) ? today : `${month}-01`}`}
              active={weekView}
              label="Hafta"
            />
          </nav>
          <nav aria-label="Dönem" className="flex items-center gap-1">
            <PageLink href={prev} label="Önceki" icon="‹" />
            <Link href={current} className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium hover:bg-zinc-50">
              Bugün
            </Link>
            <PageLink href={next} label="Sonraki" icon="›" />
          </nav>
        </div>
      </div>

      {weekView ? (
        <WeekGrid days={days} byDay={byDay} today={today} />
      ) : (
        <MonthGrid days={days} month={month} byDay={byDay} today={today} />
      )}

      {listed.length > 0 && (
        <section aria-labelledby="takvim-liste" className={weekView ? "mt-6 md:hidden" : "mt-8"}>
          <h3 id="takvim-liste" className="text-base font-semibold">
            {weekView ? "Haftanın işleri" : "Ayın işleri"}
          </h3>
          <ol className="mt-3 space-y-4">
            {[...new Set(listed.map((j) => j.day))].map((day) => (
              <li key={day}>
                <p className={`text-sm font-semibold ${day === today ? "text-brand-800" : "text-zinc-700"}`}>
                  {formatDayTitle(day)}
                  {day === today && " · bugün"}
                  {day === addDays(today, 1) && " · yarın"}
                </p>
                <ul className="mt-2 space-y-2">
                  {byDay.get(day)!.map((j) => (
                    <li key={j.id}>
                      <Card className="p-4">
                        <Link href={`/firma-paneli/isler/${j.id}`} className="block">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{routeShort(j)}</span>
                            <Badge tone={STATUS[j.status].tone}>{STATUS[j.status].label}</Badge>
                          </span>
                          <span className="mt-1 block text-sm text-zinc-600">
                            {j.customerName} · {homeTypeLabel(j.homeType)} · {formatMoney(j.priceTry)}
                          </span>
                        </Link>
                      </Card>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function ViewLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1 font-medium ${active ? "bg-brand-700 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
    >
      {label}
    </Link>
  );
}

function PageLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg hover:bg-zinc-50"
    >
      <span aria-hidden="true">{icon}</span>
    </Link>
  );
}

function DayNumber({ day, today }: { day: string; today: string }) {
  const isToday = day === today;
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
        isToday ? "bg-brand-700 text-white" : ""
      }`}
    >
      {Number(day.slice(8))}
      {isToday && <span className="sr-only"> (bugün)</span>}
    </span>
  );
}

function JobChip({ job }: { job: Job }) {
  return (
    <Link
      href={`/firma-paneli/isler/${job.id}`}
      title={`${job.customerName} · ${routeShort(job)}`}
      className={`block truncate rounded border px-1.5 py-0.5 text-xs ${chipTone[job.status]}`}
    >
      {routeShort(job)}
    </Link>
  );
}

/** Ay görünümü. Telefonda hücreler dar: iş adları yerine sayı gösterilir, ayrıntı alttaki listede. */
function MonthGrid({
  days,
  month,
  byDay,
  today,
}: {
  days: string[];
  month: string;
  byDay: Map<string, Job[]>;
  today: string;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-semibold text-zinc-600">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((day, i) => {
          const jobs = byDay.get(day) ?? [];
          const outside = !day.startsWith(month);
          const active = jobs.filter((j) => j.status !== "CANCELLED").length;
          return (
            <li
              key={day}
              aria-label={`${formatDayTitle(day)}: ${jobs.length === 0 ? "iş yok" : `${jobs.length} iş`}`}
              className={`min-h-16 border-zinc-200 p-1 sm:min-h-24 ${i % 7 !== 6 ? "border-r" : ""} ${
                i < days.length - 7 ? "border-b" : ""
              } ${outside ? "bg-zinc-50 text-zinc-500" : "bg-white"}`}
            >
              <DayNumber day={day} today={today} />
              {jobs.length > 0 && (
                <>
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold sm:hidden ${
                      active > 0 ? "bg-accent-400 text-zinc-900" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {jobs.length}
                  </span>
                  <ul className="mt-1 hidden space-y-1 sm:block">
                    {jobs.slice(0, 3).map((j) => (
                      <li key={j.id}>
                        <JobChip job={j} />
                      </li>
                    ))}
                    {jobs.length > 3 && <li className="px-1 text-xs text-zinc-600">+{jobs.length - 3} iş daha</li>}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Hafta görünümü: geniş ekranda 7 sütun, telefonda gizlenir ve alttaki gün listesi gösterilir. */
function WeekGrid({ days, byDay, today }: { days: string[]; byDay: Map<string, Job[]>; today: string }) {
  const empty = days.every((d) => !byDay.has(d));
  return (
    <>
      <ol className="mt-5 hidden grid-cols-7 overflow-hidden rounded-xl border border-zinc-200 md:grid">
        {days.map((day, i) => (
          <li key={day} className={`min-h-40 bg-white p-2 ${i < 6 ? "border-r border-zinc-200" : ""}`}>
            <p className="flex items-center justify-between text-xs font-semibold text-zinc-600">
              {WEEKDAYS_SHORT[i]}
              <DayNumber day={day} today={today} />
            </p>
            <ul className="mt-2 space-y-1.5">
              {(byDay.get(day) ?? []).map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/firma-paneli/isler/${j.id}`}
                    className={`block rounded border p-1.5 text-xs ${chipTone[j.status]}`}
                  >
                    <span className="block font-semibold">{routeShort(j)}</span>
                    <span className="block truncate">{j.customerName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {empty && <p className="mt-5 text-sm text-zinc-600 md:hidden">Bu hafta planlanmış iş yok.</p>}
    </>
  );
}
