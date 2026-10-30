import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { PAGE_KIND_LABELS, listEditablePages } from "@/lib/local-page-admin";
import { FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../admin-bits";

export const metadata: Metadata = { title: "Bölge sayfaları" };

const LIMIT = 50;
const cell = `${td} max-lg:block max-lg:border-0 max-lg:px-0 max-lg:py-1`;

/**
 * Bölge sayfaları (il, ilçe, güzergâh ve Türkiye geneli): metinleri, kapak görseli, ek içeriği ve SSS'yi yönetimden
 * değiştirmek için. Düzenlenmeyen sayfa otomatik metinle çizilir.
 */
export default async function AdminLocalPagesPage({ searchParams }: PageProps<"/yonetim/sayfalar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const onlyEdited = oneParam(params.durum) === "duzenlenen";
  const page = pageParam(params.sayfa);
  const { items: edits } = await apiFetch<{ items: { slug: string; updatedAt: string }[] }>("/admin/local-pages", { token });
  const editedAt = new Map(edits.map((e) => [e.slug, e.updatedAt]));

  const all = listEditablePages(q, new Set(editedAt.keys()));
  const rows = onlyEdited ? all.filter((p) => editedAt.has(p.slug)) : all;
  const visible = rows.slice((page - 1) * LIMIT, page * LIMIT);
  const href = (durum: string | undefined, sayfa = 1) => `/yonetim/sayfalar${query({ durum, ara: q, sayfa })}`;

  return (
    <>
      <PageHeader
        title="Bölge sayfaları"
        description="İl, ilçe ve şehirler arası sayfaların başlığını, metnini, kapak görselini ve ek içeriğini değiştir. Boş bıraktığın alanda otomatik metin kalır; kaydedince site hemen güncellenir."
      />

      <div className="mb-4 space-y-3">
        <FilterTabs
          label="Sayfa durumu"
          current={onlyEdited ? "duzenlenen" : "tumu"}
          options={[
            { value: "tumu", label: q ? "Arama sonuçları" : "Arama motoruna açık", href: href(undefined) },
            { value: "duzenlenen", label: `Düzenlenenler (${edits.length})`, href: href("duzenlenen") },
          ]}
        />
        <SearchForm
          action="/yonetim/sayfalar"
          q={q}
          placeholder="İl, ilçe ya da güzergâh ara (ör. Kadıköy, Bursa Ankara)"
          keep={{ durum: onlyEdited ? "duzenlenen" : undefined }}
        />
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm max-lg:block">
          <caption className="sr-only">Bölge sayfaları</caption>
          <thead className="max-lg:hidden">
            <tr>
              <th scope="col" className={th}>Sayfa</th>
              <th scope="col" className={`${th} w-36`}>Tür</th>
              <th scope="col" className={`${th} w-56`}>İçerik</th>
            </tr>
          </thead>
          <tbody className="max-lg:block max-lg:divide-y max-lg:divide-slate-200">
            {visible.length === 0 && (
              <tr className="max-lg:block">
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500 max-lg:block">
                  {onlyEdited ? "Henüz düzenlenen sayfa yok." : "Bu aramaya uyan sayfa yok."}
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const edited = editedAt.get(p.slug);
              return (
                <tr key={p.slug} className="hover:bg-slate-50 max-lg:block max-lg:p-4">
                  <td className={cell}>
                    <Link
                      href={`/yonetim/sayfalar/${p.slug}`}
                      className="inline-block py-0.5 font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      /{p.slug} ·{" "}
                      <Link href={`/${p.slug}`} target="_blank" className="font-medium text-brand-700 hover:underline">
                        Sitede gör ↗
                      </Link>
                    </div>
                  </td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{PAGE_KIND_LABELS[p.kind]}</Badge>
                      {!p.indexable && <Badge>Dizine kapalı</Badge>}
                    </div>
                  </td>
                  <td className={cell}>
                    {edited ? (
                      <>
                        <Badge tone="success">Düzenlendi</Badge>
                        <div className="mt-1 text-xs text-slate-600">{formatDateTime(edited)}</div>
                      </>
                    ) : (
                      <span className="text-slate-500">Otomatik metin</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} limit={LIMIT} total={rows.length} href={(p) => href(onlyEdited ? "duzenlenen" : undefined, p)} />
    </>
  );
}
