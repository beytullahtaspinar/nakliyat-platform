import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { PAGE_KIND_LABELS, getEditablePage } from "@/lib/local-page-admin";
import type { LocalPageContent } from "@/lib/local-page-content";
import { PageHeader } from "../../admin-bits";
import { LocalPageEditor } from "../local-page-editor";

export const metadata: Metadata = { title: "Bölge sayfasını düzenle" };

export default async function EditLocalPagePage({ params }: PageProps<"/yonetim/sayfalar/[slug]">) {
  const { token } = await getAdminContext();
  const { slug } = await params;
  const page = getEditablePage(slug);
  if (!page) notFound();
  // Düzenlenmemiş sayfada API boş yanıt verir
  const saved = await apiFetch<LocalPageContent | null>(`/admin/local-pages/${encodeURIComponent(slug)}`, { token });
  const content = saved && "slug" in saved ? saved : null;

  return (
    <>
      <PageHeader
        title={page.title}
        back={{ href: "/yonetim/sayfalar", label: "Bölge sayfaları" }}
        description={`${PAGE_KIND_LABELS[page.kind]} sayfası · /${page.slug} · ${
          content ? `Son değişiklik: ${formatDateTime(content.updatedAt)}` : "Otomatik metinle çiziliyor"
        }`}
      />
      <LocalPageEditor page={page} content={content} />
    </>
  );
}
