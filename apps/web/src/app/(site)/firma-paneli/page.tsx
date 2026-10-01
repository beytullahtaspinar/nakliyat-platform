import Link from "next/link";
import { Badge, Card } from "@/components/ui/card";
import { apiFetch, type CompanyRequest, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { QuoteBadge, requestFacts, route, servicesOf } from "./request-bits";

export default async function IncomingRequestsPage() {
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;
  const { items, total } = await apiFetch<Paginated<CompanyRequest>>("/company/requests?limit=50", { token });

  if (items.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Hizmet verdiğin illerde şu an açık talep yok. Yeni talepler geldikçe burada listelenecek. Daha
        fazla talep görmek için <Link href="/firma-paneli/profil" className="font-medium text-brand-700 hover:underline">hizmet illerini</Link> genişletebilirsin.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Hizmet bölgendeki {total} açık talep, taşınma tarihine göre sıralı. Müşterinin adı ve açık adresi,
        teklifin kabul edilince açılır.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((r) => {
          const services = servicesOf(r);
          return (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/firma-paneli/talepler/${r.id}`} className="font-semibold hover:underline">
                    {route(r)}
                  </Link>
                  {r.myQuote ? <QuoteBadge quote={r.myQuote} /> : <Badge tone="accent">Yeni</Badge>}
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{requestFacts(r)}</p>
                {services.length > 0 && <p className="mt-1 text-sm">İstenen: {services.join(", ")}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-500">
                    {r.quoteCount} teklif · son gün {formatDate(r.expiresAt)}
                  </span>
                  <Link href={`/firma-paneli/talepler/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                    {r.myQuote ? "Teklifini gör →" : "Teklif ver →"}
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
