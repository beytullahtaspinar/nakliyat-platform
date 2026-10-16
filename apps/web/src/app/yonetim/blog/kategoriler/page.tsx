import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import type { AdminBlogCategory } from "@/lib/blog/admin";
import { PageHeader } from "../../admin-bits";
import { CategoryForm, DeleteCategory } from "./category-form";

export const metadata: Metadata = { title: "Blog kategorileri" };

/** Kategoriler: blog menüsünde ve kendi sayfalarında (/blog/kategori/...) görünür */
export default async function BlogCategoriesPage() {
  const { token } = await getAdminContext();
  const categories = await apiFetch<AdminBlogCategory[]>("/admin/blog/categories", { token });
  return (
    <>
      <PageHeader
        title="Blog kategorileri"
        back={{ href: "/yonetim/blog", label: "Blog" }}
        description="Konu kümeleri: her kategori kendi sayfasında (/blog/kategori/...) listelenir. Açıklama, kategori sayfasının giriş metni ve arama açıklamasıdır."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ul className="space-y-3">
          {categories.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Henüz kategori yok.</li>}
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-semibold text-slate-900">{c.name}</span>{" "}
                    <span className="text-sm text-slate-500">/blog/kategori/{c.slug}</span>
                  </span>
                  <span className="text-sm text-slate-600">{c.postCount} yazı · düzenle</span>
                </summary>
                <div className="mt-4 space-y-3">
                  <CategoryForm category={c} />
                  <DeleteCategory categoryId={c.id} name={c.name} postCount={c.postCount} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Yeni kategori</h2>
          <CategoryForm category={null} />
        </div>
      </div>
    </>
  );
}
