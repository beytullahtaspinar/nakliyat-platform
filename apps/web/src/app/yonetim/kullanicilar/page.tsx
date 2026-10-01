import type { Metadata } from "next";
import Link from "next/link";
import { inputClass } from "@/components/forms/fields";
import { Badge, Card } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminUser, type Paginated, type UserRole } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { FilterTabs, Pager, VerificationBadge, query } from "../admin-bits";

export const metadata: Metadata = { title: "Kullanıcılar" };

const FILTERS: { value: string; label: string; role?: UserRole }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "musteri", label: "Müşteriler", role: "CUSTOMER" },
  { value: "firma", label: "Firmalar", role: "COMPANY" },
  { value: "yonetici", label: "Yöneticiler", role: "ADMIN" },
];
const ROLE_LABELS: Record<UserRole, string> = { CUSTOMER: "Müşteri", COMPANY: "Firma", ADMIN: "Yönetici" };
const LIMIT = 20;

export default async function AdminUsersPage({ searchParams }: PageProps<"/yonetim/kullanicilar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === oneParam(params.rol)) ?? FILTERS[0];
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminUser>>(
    `/admin/users${query({ role: filter.role, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (rol: string, sayfa = 1) =>
    `/yonetim/kullanicilar${query({ rol: rol === "tumu" ? undefined : rol, ara: q, sayfa })}`;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Kullanıcılar</h1>
      <form action="/yonetim/kullanicilar" className="mt-4 flex max-w-md gap-2" role="search">
        {filter.role && <input type="hidden" name="rol" value={filter.value} />}
        <label className="sr-only" htmlFor="ara">
          Ad, telefon veya e-posta
        </label>
        <input
          id="ara"
          name="ara"
          type="search"
          defaultValue={q}
          placeholder="Ad, telefon veya e-posta"
          className={inputClass.replace("mt-1 ", "")}
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          Ara
        </button>
      </form>
      <div className="mt-4">
        <FilterTabs
          label="Kullanıcı rolü"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
      </div>
      <p className="mt-4 text-sm text-zinc-600">{total} kullanıcı, en yenisi önce.</p>

      {items.length === 0 ? (
        <p className="mt-4 text-zinc-600">Aramaya uyan kullanıcı yok.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((u) => (
            <li key={u.id}>
              <Card className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div>
                  <p className="font-semibold">
                    <Link href={`/yonetim/kullanicilar/${u.id}`} className="hover:underline">
                      {u.fullName}
                    </Link>{" "}
                    <span className="text-sm font-normal text-zinc-500">· {ROLE_LABELS[u.role]}</span>
                  </p>
                  <p className="text-sm text-zinc-600">
                    <a href={`tel:${u.phone}`} className="text-brand-700 hover:underline">
                      {formatPhone(u.phone)}
                    </a>
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                  {u.company && (
                    <p className="mt-1 text-sm">
                      <Link href={`/yonetim/firmalar/${u.company.id}`} className="font-medium text-brand-700 hover:underline">
                        {u.company.displayName}
                      </Link>{" "}
                      <VerificationBadge status={u.company.verificationStatus} />
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-zinc-500">
                  {u.status === "SUSPENDED" && <Badge tone="warning">Askıda</Badge>}
                  <p>Kayıt {formatDate(u.createdAt)}</p>
                  {u.role === "CUSTOMER" && <p>{u.requestCount} talep</p>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
