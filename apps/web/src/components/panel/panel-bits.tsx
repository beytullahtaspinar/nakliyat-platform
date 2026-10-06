import Link from "next/link";

/*
 * Yönetim paneli ve firma paneli (CRM düzeni) için ortak parçalar: sayfa başlığı, süzgeç sekmeleri,
 * arama, tablo ve sayfalama. Açık zemin; renkler slate + brand/accent.
 */

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
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
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

/** Tablo kabı: dar ekranda yatay kaydırılır (minWidth px altına sıkışmaz) */
export function DataTable({ label, children, minWidth = 720 }: { label: string; children: React.ReactNode; minWidth?: number }) {
  return (
    // tabIndex: dar ekranda yana kayan tablo klavyeyle de kaydırılabilsin (içinde bağlantı olmasa bile)
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-brand-700/40 focus-visible:outline-none"
    >
      <table className="w-full text-left text-sm" style={{ minWidth }}>
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

export type Stat = {
  label: string;
  value: React.ReactNode;
  href: string;
  /** Kısa ek bilgi (ör. "geçen ay 12.000 TL") */
  hint?: string;
  /** Bekleyen iş varsa vurgulanır */
  highlight?: boolean;
};

/** Pano sayıları: her kart ilgili listeye götürür */
export function StatGrid({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  return (
    <ul className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${className}`}>
      {stats.map((s) => (
        <li key={s.label}>
          <Link
            href={s.href}
            className={`block h-full rounded-xl border bg-white p-4 shadow-sm hover:border-brand-300 ${
              s.highlight ? "border-accent-300 ring-1 ring-accent-300" : "border-slate-200"
            }`}
          >
            <p className={`text-2xl font-bold tabular-nums ${s.highlight ? "text-accent-800" : "text-slate-900"}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            {s.hint && <p className="mt-0.5 text-xs text-slate-500">{s.hint}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Panel bölümü: başlıklı beyaz kutu. Formlar ve ayrıntı kartları aynı görünür.
 * Başlık bölgeyi adlandırır (ekran okuyucuda "bölge").
 */
export function PanelSection({
  id,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-baslik`}
      className={`scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-baslik`} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
        </div>
        {actions}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Tablo bölümü başlığı: solda başlık, sağda "Tümü" bağlantısı */
export function TableHeading({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 id={id} className="font-semibold text-slate-900">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-brand-700 hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
