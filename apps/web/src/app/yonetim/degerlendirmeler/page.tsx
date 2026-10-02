import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { ReviewCard } from "@/components/reviews/review-card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch, type AdminReview, type Paginated } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { companyPath } from "@/lib/reviews";
import { FilterTabs, PageHeader, Pager, SearchForm, query } from "../admin-bits";
import { ReviewModeration } from "./review-moderation";

export const metadata: Metadata = { title: "Değerlendirmeler" };

const FILTERS: { value: string; label: string; status?: "visible" | "hidden"; rating?: number }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "dusuk", label: "1 yıldız", rating: 1 },
  { value: "yayinda", label: "Yayında", status: "visible" },
  { value: "gizli", label: "Gizlenen", status: "hidden" },
];
const LIMIT = 25;

/**
 * Müşteri yorumları, en yeni önce. Yorumlar onaysız yayımlanır; kurallara uymayanı (hakaret, kişisel
 * bilgi, reklam) yönetici gerekçeyle gizler. Gizli yorum firma sayfasından ve puan ortalamasından çıkar.
 */
export default async function AdminReviewsPage({ searchParams }: PageProps<"/yonetim/degerlendirmeler">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((f) => f.value === oneParam(params.durum)) ?? FILTERS[0];
  const page = pageParam(params.sayfa);
  const { items, total } = await apiFetch<Paginated<AdminReview>>(
    `/admin/reviews${query({ status: filter.status, rating: filter.rating, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (durum: string, sayfa = 1) =>
    `/yonetim/degerlendirmeler${query({ durum: durum === "tumu" ? undefined : durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Değerlendirmeler"
        description="Müşteri yorumları onaysız yayımlanır. Hakaret, kişisel bilgi ya da reklam içereni gerekçe yazarak gizle."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Değerlendirme süzgeci"
          current={filter.value}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: href(f.value) }))}
        />
        <SearchForm
          action="/yonetim/degerlendirmeler"
          q={q}
          placeholder="Firma adı veya yorum metni"
          keep={{ durum: oneParam(params.durum) }}
        />
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
          Bu süzgece uyan değerlendirme yok.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Değerlendirmeler">
          {items.map((r) => (
            <ReviewCard
              key={r.id}
              as="li"
              review={r}
              companyName={r.company.displayName}
              author={
                <>
                  <Link href={`/yonetim/firmalar/${r.company.id}`} className="font-semibold text-slate-900 hover:underline">
                    {r.company.displayName}
                  </Link>{" "}
                  ·{" "}
                  <Link href={`/yonetim/kullanicilar/${r.customer.id}`} className="hover:underline">
                    {r.customer.fullName}
                  </Link>{" "}
                  ·{" "}
                  <Link href={`/yonetim/talepler/${r.requestId}`} className="hover:underline">
                    {r.route}
                  </Link>
                </>
              }
            >
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.isPublished ? (
                  <Badge tone="success">Yayında</Badge>
                ) : (
                  <Badge tone="warning">Gizli{r.hiddenAt && ` · ${formatDateTime(r.hiddenAt)}`}</Badge>
                )}
                {r.isPublished && (
                  <Link href={`${companyPath(r.company)}#yorumlar`} className="text-sm font-medium text-brand-700 hover:underline">
                    Firma sayfasında gör
                  </Link>
                )}
              </div>
              {r.hiddenReason && <p className="mt-2 text-sm text-slate-700">Gizleme gerekçesi: {r.hiddenReason}</p>}
              <div className="mt-3">
                <ReviewModeration reviewId={r.id} isPublished={r.isPublished} />
              </div>
            </ReviewCard>
          ))}
        </ul>
      )}
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(filter.value, p)} />
    </>
  );
}
