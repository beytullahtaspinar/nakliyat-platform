import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/card";
import { getAdminContext, oneParam, pageParam } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  PAGE_KIND_LABELS,
  getCityGroupPages,
  getEditablePage,
  HUB_SLUG,
  listCityGroups,
  listEditablePages,
  type EditablePage,
} from "@/lib/local-page-admin";
import { isIndexable } from "@/lib/local-seo";
import { FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "../admin-bits";
import { IndexNowButton } from "./indexnow-button";

export const metadata: Metadata = { title: "Bölge sayfaları" };

const LIMIT = 50;
const cell = `${td} max-lg:block max-lg:border-0 max-lg:px-0 max-lg:py-1`;
const link = "inline-block py-0.5 font-semibold text-slate-900 hover:text-brand-700 hover:underline";

/**
 * Bölge sayfaları (il, ilçe, güzergâh ve Türkiye geneli): metinleri, kapak görseli, ek içeriği ve SSS'yi yönetimden
 * değiştirmek için. Düzenlenmeyen sayfa otomatik metinle çizilir.
 * Varsayılan görünüm il listesidir; bir il açılınca o ilin ilçe ve şehirler arası sayfaları gelir (?il=bursa).
 * Arama ve "Düzenlenenler" tüm sayfalarda düz liste döner.
 */
export default async function AdminLocalPagesPage({ searchParams }: PageProps<"/yonetim/sayfalar">) {
  const { token } = await getAdminContext();
  const params = await searchParams;
  const q = oneParam(params.ara)?.trim().slice(0, 100) || undefined;
  const onlyEdited = oneParam(params.durum) === "duzenlenen";
  const citySlug = oneParam(params.il);
  const page = pageParam(params.sayfa);
  const { items: edits } = await apiFetch<{ items: { slug: string; updatedAt: string }[] }>("/admin/local-pages", { token });
  const editedAt = new Map(edits.map((e) => [e.slug, e.updatedAt]));

  const href = (durum: string | undefined, sayfa = 1) => `/yonetim/sayfalar${query({ durum, ara: q, sayfa })}`;
  const mode = q || onlyEdited ? "list" : citySlug ? "city" : "cities";

  return (
    <>
      <PageHeader
        title="Bölge sayfaları"
        description="İl, ilçe ve şehirler arası sayfaların başlığını, metnini, kapak görselini ve ek içeriğini değiştir. Boş bıraktığın alanda otomatik metin kalır; kaydedince site hemen güncellenir ve sayfa Bing'e bildirilir."
        actions={<IndexNowButton />}
      />

      <div className="mb-4 space-y-3">
        <FilterTabs
          label="Sayfa görünümü"
          current={onlyEdited ? "duzenlenen" : "iller"}
          options={[
            { value: "iller", label: q ? "Arama sonuçları" : "İllere göre", href: q ? href(undefined) : "/yonetim/sayfalar" },
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

      {mode === "cities" && <CityList editedAt={editedAt} />}
      {mode === "city" && <CityDetail slug={citySlug!} editedAt={editedAt} />}
      {mode === "list" && (
        <FlatList q={q} onlyEdited={onlyEdited} page={page} editedAt={editedAt} href={href} />
      )}
    </>
  );
}

type Edited = Map<string, string>;

/** 81 il ve Türkiye geneli sayfası; her ilde ilçe ve güzergâh sayısı ile düzenlenen sayfa sayısı */
function CityList({ editedAt }: { editedAt: Edited }) {
  const hub = getEditablePage(HUB_SLUG)!;
  const groups = listCityGroups();
  const count = (pages: { slug: string }[]) => pages.filter((p) => editedAt.has(p.slug)).length;
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm max-lg:block">
        <caption className="sr-only">İllere göre bölge sayfaları</caption>
        <thead className="max-lg:hidden">
          <tr>
            <th scope="col" className={th}>İl</th>
            <th scope="col" className={`${th} w-56`}>İlçe ve şehirler arası sayfalar</th>
            <th scope="col" className={`${th} w-44`}>Düzenlenen</th>
          </tr>
        </thead>
        <tbody className="max-lg:block max-lg:divide-y max-lg:divide-slate-200">
          <tr className="hover:bg-slate-50 max-lg:block max-lg:p-4">
            <td className={cell}>
              <Link href={`/yonetim/sayfalar/${hub.slug}`} className={link}>
                {hub.title}
              </Link>
              <div className="text-xs text-slate-500">/{hub.slug}</div>
            </td>
            <td className={cell}>
              <Badge>{PAGE_KIND_LABELS.hub}</Badge>
            </td>
            <td className={cell}>
              <EditedCell at={editedAt.get(hub.slug)} />
            </td>
          </tr>
          {groups.map((g) => {
            const subPages = [...g.districts, ...g.routes];
            const edited = count([g.page, ...subPages]);
            const openDistricts = g.districts.filter(isIndexable).length;
            return (
              <tr key={g.city.slug} className="hover:bg-slate-50 max-lg:block max-lg:p-4">
                <td className={cell}>
                  <Link href={`/yonetim/sayfalar?il=${g.city.slug}`} className={link}>
                    {g.city.name}
                  </Link>
                  <div>
                    <Link
                      href={`/yonetim/sayfalar/${g.page.slug}`}
                      className="inline-block py-1 text-sm font-medium text-brand-700 hover:underline"
                    >
                      İl sayfasını düzenle
                    </Link>
                  </div>
                </td>
                <td className={cell}>
                  <Link href={`/yonetim/sayfalar?il=${g.city.slug}`} className="font-medium text-brand-700 hover:underline">
                    {g.districts.length} ilçe · {g.routes.length} güzergâh →
                  </Link>
                  {openDistricts > 0 && <div className="text-xs text-slate-500">{openDistricts} ilçe arama motoruna açık</div>}
                </td>
                <td className={cell}>
                  {edited ? <Badge tone="success">{edited} sayfa</Badge> : <span className="text-slate-500">Yok</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Bir ilin il sayfası, ilçe sayfaları ve o ilden çıkan şehirler arası sayfaları */
function CityDetail({ slug, editedAt }: { slug: string; editedAt: Edited }) {
  const group = getCityGroupPages(slug);
  if (!group) notFound();
  return (
    <div className="space-y-8">
      <div>
        <Link href="/yonetim/sayfalar" className="text-sm font-medium text-brand-700 hover:underline">
          ← Tüm iller
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{group.city.name}</h2>
      </div>
      <PageSection title="İl sayfası" pages={[group.page]} editedAt={editedAt} />
      <PageSection title={`İlçeler (${group.districts.length})`} pages={group.districts} editedAt={editedAt} />
      <PageSection
        title={`${group.city.name} çıkışlı şehirler arası (${group.routes.length})`}
        pages={group.routes}
        editedAt={editedAt}
      />
    </div>
  );
}

function PageSection({ title, pages, editedAt }: { title: string; pages: EditablePage[]; editedAt: Edited }) {
  return (
    <section>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <PageTable pages={pages} editedAt={editedAt} caption={title} empty="Bu grupta sayfa yok." />
    </section>
  );
}

/** Arama sonuçları ya da düzenlenen sayfalar: tüm türler tek listede */
function FlatList({
  q,
  onlyEdited,
  page,
  editedAt,
  href,
}: {
  q: string | undefined;
  onlyEdited: boolean;
  page: number;
  editedAt: Edited;
  href: (durum: string | undefined, sayfa?: number) => string;
}) {
  const all = listEditablePages(q, new Set(editedAt.keys()));
  const rows = onlyEdited ? all.filter((p) => editedAt.has(p.slug)) : all;
  const visible = rows.slice((page - 1) * LIMIT, page * LIMIT);
  return (
    <>
      <PageTable
        pages={visible}
        editedAt={editedAt}
        caption="Bölge sayfaları"
        empty={onlyEdited ? "Henüz düzenlenen sayfa yok." : "Bu aramaya uyan sayfa yok."}
      />
      <Pager page={page} limit={LIMIT} total={rows.length} href={(p) => href(onlyEdited ? "duzenlenen" : undefined, p)} />
    </>
  );
}

function PageTable({
  pages,
  editedAt,
  caption,
  empty,
}: {
  pages: EditablePage[];
  editedAt: Edited;
  caption: string;
  empty: string;
}) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm max-lg:block">
        <caption className="sr-only">{caption}</caption>
        <thead className="max-lg:hidden">
          <tr>
            <th scope="col" className={th}>Sayfa</th>
            <th scope="col" className={`${th} w-36`}>Tür</th>
            <th scope="col" className={`${th} w-56`}>İçerik</th>
          </tr>
        </thead>
        <tbody className="max-lg:block max-lg:divide-y max-lg:divide-slate-200">
          {pages.length === 0 && (
            <tr className="max-lg:block">
              <td colSpan={3} className="px-4 py-10 text-center text-slate-500 max-lg:block">
                {empty}
              </td>
            </tr>
          )}
          {pages.map((p) => (
            <tr key={p.slug} className="hover:bg-slate-50 max-lg:block max-lg:p-4">
              <td className={cell}>
                <Link href={`/yonetim/sayfalar/${p.slug}`} className={link}>
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
                <EditedCell at={editedAt.get(p.slug)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditedCell({ at }: { at: string | undefined }) {
  return at ? (
    <>
      <Badge tone="success">Düzenlendi</Badge>
      <div className="mt-1 text-xs text-slate-600">{formatDateTime(at)}</div>
    </>
  ) : (
    <span className="text-slate-500">Otomatik metin</span>
  );
}
