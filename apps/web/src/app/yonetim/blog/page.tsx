import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { POST_STATE_LABELS, type AdminBlogPosts } from "@/lib/blog/admin";
import { postPath } from "@/lib/blog/rules";
import { formatDateTime } from "@/lib/format";
import { FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../admin-bits";

export const metadata: Metadata = { title: "Blog" };

const TABS = [
  { value: "tumu", label: "Tümü", status: undefined, count: "all" },
  { value: "yayinda", label: "Yayında", status: "published", count: "published" },
  { value: "zamanlanmis", label: "Zamanlanmış", status: "scheduled", count: "scheduled" },
  { value: "taslak", label: "Taslak", status: "draft", count: "draft" },
] as const;
const LIMIT = 25;
const cell = `${td} max-lg:block max-lg:border-0 max-lg:px-0 max-lg:py-1`;

/** Blog yazıları: taslak, zamanlanmış ve yayındakiler. Yazı yönetimde yazılır, sitede /blog altında yayınlanır. */
export default async function AdminBlogPage({ searchParams }: PageProps<"/yonetim/blog">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const tab = TABS.find((t) => t.value === oneParam(params.durum)) ?? TABS[0];
  const page = pageParam(params.sayfa);
  const { items, total, counts } = await apiFetch<AdminBlogPosts>(
    `/admin/blog/posts${query({ status: tab.status, q, page, limit: LIMIT })}`,
    { token },
  );
  const href = (value: string, sayfa = 1) => `/yonetim/blog${query({ durum: value === "tumu" ? undefined : value, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Blog"
        description={
          <>
            Taşınma rehberleri sitede{" "}
            <Link href="/blog" className="font-medium text-brand-700 hover:underline">
              /blog
            </Link>{" "}
            altında yayınlanır. Kaydedince site hemen güncellenir.
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/yonetim/blog/kategoriler" variant="secondary" size="sm">
              Kategoriler
            </ButtonLink>
            <ButtonLink href="/yonetim/blog/yazarlar" variant="secondary" size="sm">
              Yazarlar
            </ButtonLink>
            <ButtonLink href="/yonetim/blog/yeni" size="sm">
              Yeni yazı
            </ButtonLink>
          </div>
        }
      />
      {oneParam(params.silindi) && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Yazı silindi.
        </p>
      )}

      <div className="mb-4 space-y-3">
        <FilterTabs
          label="Yazı durumu"
          current={tab.value}
          options={TABS.map((t) => ({ value: t.value, label: `${t.label} (${counts[t.count]})`, href: href(t.value) }))}
        />
        <SearchForm action="/yonetim/blog" q={q} placeholder="Başlık veya adreste ara" keep={{ durum: tab.status ? tab.value : undefined }} />
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm max-lg:block">
          <caption className="sr-only">Blog yazıları</caption>
          <thead className="max-lg:hidden">
            <tr>
              <th scope="col" className={th}>Başlık</th>
              <th scope="col" className={`${th} w-40`}>Kategori</th>
              <th scope="col" className={`${th} w-40`}>Yazar</th>
              <th scope="col" className={`${th} w-36`}>Durum</th>
              <th scope="col" className={`${th} w-44`}>Son değişiklik</th>
            </tr>
          </thead>
          <tbody className="max-lg:block max-lg:divide-y max-lg:divide-slate-200">
            {items.length === 0 && (
              <tr className="max-lg:block">
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 max-lg:block">
                  {counts.all === 0 ? "Henüz yazı yok. İlk yazıyı \"Yeni yazı\" ile başlat." : "Bu süzgece uyan yazı yok."}
                </td>
              </tr>
            )}
            {items.map((p) => {
              const s = POST_STATE_LABELS[p.state];
              return (
                <tr key={p.id} className="hover:bg-slate-50 max-lg:block max-lg:p-4">
                  <td className={cell}>
                    <Link href={`/yonetim/blog/${p.id}`} className="inline-block py-0.5 font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {postPath(p)}
                      {p.state === "published" && (
                        <>
                          {" · "}
                          <Link href={postPath(p)} target="_blank" className="font-medium text-brand-700 hover:underline">
                            Sitede gör ↗
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                  <td className={cell}>{p.category?.name ?? <span className="text-slate-500">Kategorisiz</span>}</td>
                  <td className={cell}>{p.author?.name ?? <span className="text-slate-500">İmzasız</span>}</td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {p.noindex && <Badge>Dizine kapalı</Badge>}
                    </div>
                    {p.state === "scheduled" && p.publishedAt && (
                      <div className="mt-1 text-xs text-slate-600">{formatDateTime(p.publishedAt)}</div>
                    )}
                  </td>
                  <td className={`${cell} text-slate-600`}>{formatDateTime(p.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} limit={LIMIT} total={total} href={(p) => href(tab.value, p)} />
    </>
  );
}
