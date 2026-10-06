import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, query, td, th } from "@/components/panel/panel-bits";
import { ButtonLink } from "@/components/ui/button";
import { apiFetch, type CompanyRequest, type Paginated } from "@/lib/api";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { routeText } from "@/lib/geo";
import { oneParam, pageParam } from "@/lib/params";
import { homeTypeLabel } from "@/lib/request-options";
import { RequestFlags, RequestStateBadge, daysText, daysUntil, route } from "../request-bits";

export const metadata: Metadata = { title: "Gelen talepler" };

const FILTERS = [
  { value: "tumu", label: "Tümü" },
  { value: "yeni", label: "Teklif vermediklerim", quoted: "no" },
  { value: "teklif-verdiklerim", label: "Teklif verdiklerim", quoted: "yes" },
] as const;
const LIMIT = 25;

/** Hizmet bölgendeki açık talepler: taşınma tarihi yakın olan önce */
export default async function IncomingRequestsPage({ searchParams }: PageProps<"/firma-paneli/talepler">) {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const area = new Set([profile.cityCode, ...profile.serviceCityCodes]);
  const cities = cityOptions.filter((c) => area.has(c.code));
  const city = cities.find((c) => c.code === oneParam(params.il))?.code;
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<CompanyRequest>>(
    `/company/requests${query({ quoted: "quoted" in filter ? filter.quoted : undefined, city, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/firma-paneli/talepler${query({ durum: durum === "tumu" ? undefined : durum, il: city, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Gelen talepler"
        description="Hizmet bölgendeki açık talepler, taşınma tarihi yakın olan önce. Müşterinin adı ve açık adresi teklifin kabul edilince açılır."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Teklif durumu"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        {cities.length > 1 && (
          <form action="/firma-paneli/talepler" className="flex items-center gap-2 text-sm">
            {filter.value !== "tumu" && <input type="hidden" name="durum" value={filter.value} />}
            <label htmlFor="il" className="font-medium text-slate-700">
              İl
            </label>
            <select
              id="il"
              name="il"
              defaultValue={city ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 focus:outline-none"
            >
              <option value="">Tüm hizmet illerim</option>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800">
              Süz
            </button>
          </form>
        )}
      </div>

      <DataTable label="Gelen talepler">
        <thead>
          <tr>
            <th scope="col" className={th}>Güzergâh</th>
            <th scope="col" className={th}>Taşınma</th>
            <th scope="col" className={th}>Ev ve yol</th>
            <th scope="col" className={th}>Teklif</th>
            <th scope="col" className={th}>Son gün</th>
            <th scope="col" className={th}>Durum</th>
            <th scope="col" className={th}><span className="sr-only">İşlem</span></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <EmptyRow colSpan={7}>
              {filter.value === "tumu" && !city ? (
                <>
                  Hizmet verdiğin illerde şu an açık talep yok. Daha fazla talep görmek için{" "}
                  <Link href="/firma-paneli/profil" className="font-medium text-brand-700 hover:underline">
                    hizmet illerini
                  </Link>{" "}
                  genişletebilirsin.
                </>
              ) : (
                "Bu süzgece uyan talep yok."
              )}
            </EmptyRow>
          )}
          {items.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className={`${td} min-w-64`}>
                <Link href={`/firma-paneli/talepler/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                  {route(r)}
                </Link>
                <RequestFlags request={r} className="mt-1.5" />
              </td>
              <td className={`${td} whitespace-nowrap`}>
                {formatDate(r.moveDate)}
                <div className="text-xs text-slate-600">
                  {[daysText(daysUntil(r.moveDate)), r.isDateFlexible && "esnek"].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td className={td}>
                {homeTypeLabel(r.homeType)}
                <div className="text-xs text-slate-500">
                  {[routeText(r) ?? (r.distanceKm ? `${r.distanceKm} km` : "Şehir içi"), r.estimatedVolumeM3 && `~${r.estimatedVolumeM3} m³`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              <td className={`${td} tabular-nums`}>{r.quoteCount}</td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(r.expiresAt)}</td>
              <td className={td}>
                <RequestStateBadge request={r} />
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                {r.myQuote ? (
                  <Link href={`/firma-paneli/talepler/${r.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                    Teklifini gör
                  </Link>
                ) : (
                  <ButtonLink href={`/firma-paneli/talepler/${r.id}`} size="sm">
                    Teklif ver
                  </ButtonLink>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
