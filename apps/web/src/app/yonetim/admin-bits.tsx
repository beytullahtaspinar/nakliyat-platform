import Link from "next/link";
import { Badge } from "@/components/ui/card";
import type { UserRole, VerificationStatus } from "@/lib/api";

export const ROLE_LABELS: Record<UserRole, string> = { CUSTOMER: "Müşteri", COMPANY: "Firma", ADMIN: "Yönetici" };

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "Onay bekliyor", tone: "warning" },
  VERIFIED: { label: "Onaylı", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "neutral" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFICATION[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

/** Durum/rol süzgeci: seçili olan sayfa olarak işaretlenir */
export function FilterTabs({
  label,
  options,
  current,
}: {
  label: string;
  options: { href: string; label: string; value: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.value}>
              <Link
                href={o.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${
                  active
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablo altı: toplam kayıt ve önceki / sonraki sayfa */
export function Pager({
  page,
  limit,
  total,
  href,
}: {
  page: number;
  limit: number;
  total: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const link = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50";
  return (
    <nav aria-label="Sayfalar" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        {total} kayıt{pages > 1 ? ` · sayfa ${page} / ${pages}` : ""}
      </span>
      {pages > 1 && (
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={href(page - 1)} className={link}>
              ← Önceki
            </Link>
          )}
          {page < pages && (
            <Link href={href(page + 1)} className={link}>
              Sonraki →
            </Link>
          )}
        </span>
      )}
    </nav>
  );
}

/** Sorgu metni: boş değerler atılır */
export function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && !(key === "sayfa" && value === 1)) q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Sayfa başlığı: başlık, kısa açıklama ve sağda işlemler */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {back && (
        <p className="mb-2 text-sm">
          <Link href={back.href} className="font-medium text-brand-700 hover:underline">
            ← {back.label}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
        </div>
        {actions}
      </div>
    </div>
  );
}

/**
 * Arama kutusu (GET formu). Diğer süzgeçler gizli alanla korunur; arama yapılınca ilk sayfaya dönülür.
 */
export function SearchForm({
  action,
  q,
  placeholder,
  keep = {},
}: {
  action: string;
  q?: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} role="search" className="flex w-full max-w-md gap-2">
      {Object.entries(keep).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <label htmlFor="ara" className="sr-only">
        {placeholder}
      </label>
      <input
        id="ara"
        name="ara"
        type="search"
        defaultValue={q}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 focus:outline-none"
      />
      <button type="submit" className="rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
        Ara
      </button>
    </form>
  );
}

/** Tablo kabı: dar ekranda yatay kaydırılır */
export function DataTable({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = "border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "border-b border-slate-100 px-4 py-3 align-top";

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
        {children}
      </td>
    </tr>
  );
}
