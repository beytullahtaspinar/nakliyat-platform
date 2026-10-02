import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminUser, type Paginated, type UserRole } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import {
  DataTable,
  EmptyRow,
  FilterTabs,
  PageHeader,
  Pager,
  ROLE_LABELS,
  SearchForm,
  VerificationBadge,
  query,
  td,
  th,
} from "../admin-bits";

export const metadata: Metadata = { title: "Kullanıcılar" };

const FILTERS: { value: string; label: string; role?: UserRole }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "musteri", label: "Müşteriler", role: "CUSTOMER" },
  { value: "firma", label: "Firmalar", role: "COMPANY" },
  { value: "yonetici", label: "Yöneticiler", role: "ADMIN" },
];
const LIMIT = 25;

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
      <PageHeader title="Kullanıcılar" description="Müşteri, firma ve yönetici hesapları." />
      {params.silindi && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Hesap silindi.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Kullanıcı rolü"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm action="/yonetim/kullanicilar" q={q} placeholder="Ad, telefon veya e-posta" keep={{ rol: oneParam(params.rol) }} />
      </div>

      <DataTable label="Kullanıcılar">
        <thead>
          <tr>
            <th scope="col" className={th}>Ad soyad</th>
            <th scope="col" className={th}>Rol</th>
            <th scope="col" className={th}>Telefon</th>
            <th scope="col" className={th}>E-posta</th>
            <th scope="col" className={th}>Firma / talep</th>
            <th scope="col" className={th}>Hesap</th>
            <th scope="col" className={th}>Kayıt</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={7}>Aramaya uyan kullanıcı yok.</EmptyRow>}
          {items.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className={td}>
                <Link href={`/yonetim/kullanicilar/${u.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                  {u.fullName}
                </Link>
              </td>
              <td className={td}>{ROLE_LABELS[u.role]}</td>
              <td className={`${td} whitespace-nowrap`}>{formatPhone(u.phone)}</td>
              <td className={td}>{u.email ?? <span className="text-slate-500">Yok</span>}</td>
              <td className={td}>
                {u.company ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/yonetim/firmalar/${u.company.id}`} className="text-brand-700 hover:underline">
                      {u.company.displayName}
                    </Link>
                    <VerificationBadge status={u.company.verificationStatus} />
                  </span>
                ) : u.role === "CUSTOMER" ? (
                  `${u.requestCount} talep`
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className={td}>
                {u.status === "SUSPENDED" ? <Badge tone="warning">Askıda</Badge> : <Badge tone="success">Aktif</Badge>}
              </td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
