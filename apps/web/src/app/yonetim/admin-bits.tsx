import Link from "next/link";
import { Badge } from "@/components/ui/card";
import type { VerificationStatus } from "@/lib/api";

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

/** Önceki / sonraki sayfa bağlantıları; tek sayfaysa hiçbir şey göstermez */
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
  if (pages <= 1) return null;
  const link = "font-semibold text-brand-700 hover:underline";
  return (
    <nav aria-label="Sayfalar" className="mt-6 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className={link}>← Önceki</Link> : <span />}
      <span className="text-zinc-500">
        Sayfa {page} / {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)} className={link}>Sonraki →</Link> : <span />}
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
