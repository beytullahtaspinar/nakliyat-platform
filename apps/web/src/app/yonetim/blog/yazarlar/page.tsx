import type { Metadata } from "next";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import type { AdminBlogAuthor } from "@/lib/blog/admin";
import { authorPath } from "@/lib/blog/rules";
import { PageHeader } from "../../admin-bits";
import { AuthorForm, DeleteAuthor } from "./author-form";

export const metadata: Metadata = { title: "Blog yazarları" };

/** Yazar profilleri (E-E-A-T): her yazıda imza ve kendi sayfası (/blog/yazar/...) */
export default async function BlogAuthorsPage() {
  const { token } = await getAdminContext();
  const authors = await apiFetch<AdminBlogAuthor[]>("/admin/blog/authors", { token });
  return (
    <>
      <PageHeader
        title="Blog yazarları"
        back={{ href: "/yonetim/blog", label: "Blog" }}
        description="Google ve yapay zekâ motorları içeriği kimin, hangi deneyimle yazdığına bakar. Gerçek kişi, unvan, kısa özgeçmiş ve profil bağlantıları ekle."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <ul className="space-y-3">
          {authors.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Henüz yazar yok.</li>}
          {authors.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    {a.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.photo.thumb.src} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
                    )}
                    <span>
                      <span className="font-semibold text-slate-900">{a.name}</span>
                      {a.jobTitle && <span className="block text-sm text-slate-600">{a.jobTitle}</span>}
                    </span>
                  </span>
                  <span className="text-sm text-slate-600">{a.postCount} yazı · düzenle</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {a.postCount > 0 && (
                    <Link href={authorPath(a)} target="_blank" className="text-sm font-medium text-brand-700 hover:underline">
                      Yazar sayfasını gör ↗
                    </Link>
                  )}
                  <AuthorForm author={a} />
                  <DeleteAuthor authorId={a.id} name={a.name} postCount={a.postCount} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Yeni yazar</h2>
          <AuthorForm author={null} />
        </div>
      </div>
    </>
  );
}
