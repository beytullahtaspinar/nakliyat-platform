import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminContext, oneParam } from "@/lib/admin";
import { ApiError, apiFetch } from "@/lib/api";
import type { AdminBlogAuthor, AdminBlogCategory, AdminBlogPost } from "@/lib/blog/admin";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "../../admin-bits";
import { DeletePost } from "../delete-post";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Yazıyı düzenle" };

const SAVED: Record<string, string> = {
  published: "Yazı yayında; sitedeki sayfa güncellendi.",
  scheduled: "Yazı zamanlandı; yayın saatinde sitede görünecek.",
  draft: "Taslak kaydedildi; sitede görünmüyor.",
};

export default async function EditBlogPostPage({ params, searchParams }: PageProps<"/yonetim/blog/[id]">) {
  const { token } = await getAdminContext();
  const { id } = await params;
  const saved = oneParam((await searchParams).kaydedildi);
  const [post, categories, authors] = await Promise.all([
    apiFetch<AdminBlogPost>(`/admin/blog/posts/${encodeURIComponent(id)}`, { token }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    }),
    apiFetch<AdminBlogCategory[]>("/admin/blog/categories", { token }),
    apiFetch<AdminBlogAuthor[]>("/admin/blog/authors", { token }),
  ]);
  return (
    <>
      <PageHeader
        title={post.title}
        back={{ href: "/yonetim/blog", label: "Blog" }}
        description={`Son değişiklik: ${formatDateTime(post.updatedAt)}`}
        actions={<DeletePost postId={post.id} title={post.title} />}
      />
      <PostEditor post={post} categories={categories} authors={authors} savedNotice={saved ? SAVED[saved] : undefined} />
    </>
  );
}
