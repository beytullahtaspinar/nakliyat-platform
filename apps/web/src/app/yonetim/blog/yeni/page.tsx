import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import type { AdminBlogAuthor, AdminBlogCategory } from "@/lib/blog/admin";
import { PageHeader } from "../../admin-bits";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Yeni yazı" };

export default async function NewBlogPostPage() {
  const { token } = await getAdminContext();
  const [categories, authors] = await Promise.all([
    apiFetch<AdminBlogCategory[]>("/admin/blog/categories", { token }),
    apiFetch<AdminBlogAuthor[]>("/admin/blog/authors", { token }),
  ]);
  return (
    <>
      <PageHeader title="Yeni yazı" back={{ href: "/yonetim/blog", label: "Blog" }} />
      <PostEditor post={null} categories={categories} authors={authors} />
    </>
  );
}
