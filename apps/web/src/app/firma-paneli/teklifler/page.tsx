import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { apiFetch, type CompanyQuote, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { QuoteBadge, requestFacts, route } from "../request-bits";

export const metadata: Metadata = { title: "Tekliflerim" };

export default async function CompanyQuotesPage() {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const { items } = await apiFetch<Paginated<CompanyQuote>>("/company/quotes?limit=50", { token });

  if (items.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Henüz teklif vermedin.{" "}
        <Link href="/firma-paneli" className="font-medium text-brand-700 hover:underline">
          Gelen taleplere göz at
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((q) => (
        <li key={q.id}>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={`/firma-paneli/talepler/${q.request.id}`} className="font-semibold hover:underline">
                {route(q.request)}
              </Link>
              <QuoteBadge quote={q} />
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{requestFacts(q.request)}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {formatDate(q.createdAt)} tarihinde verildi · geçerlilik {formatDate(q.validUntil)}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
