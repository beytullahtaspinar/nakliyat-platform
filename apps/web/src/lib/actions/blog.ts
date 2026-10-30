"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { istanbulLocalToIso, type AdminBlogPost, type BlogMediaItem } from "@/lib/blog/admin";
import { renderContent } from "@/lib/blog/content";
import { BLOG_CACHE_TAG, BLOG_PATH, postPath } from "@/lib/blog/rules";
import { notifyIndexNow } from "@/lib/indexnow";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import type { UploadTicket } from "./media";

export type BlogActionState = { error?: string; notice?: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function adminToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new ApiError(401, "Oturumun sona ermiş, lütfen tekrar giriş yap.");
  return (await getAccessToken())!;
}

async function run<T>(fn: () => Promise<T>, fallback: string): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : fallback };
  }
}

/**
 * Sitedeki blog sayfaları hemen yenilensin: önbellek etiketi + derlemede üretilen sayfalar (o sırada API'ye
 * ulaşılamadıysa etiket taşımazlar), site haritası ve llms.txt.
 */
function refreshSite() {
  updateTag(BLOG_CACHE_TAG);
  revalidatePath(BLOG_PATH, "layout");
  for (const path of [`${BLOG_PATH}/rss.xml`, "/sitemap.xml", "/llms.txt"]) revalidatePath(path);
  revalidatePath("/yonetim/blog", "layout");
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// ─── Yazılar ───────────────────────────────────────────────────

export async function savePost(id: string | null, _prev: BlogActionState, formData: FormData): Promise<BlogActionState> {
  const intent = text(formData, "intent");
  const publishAtLocal = text(formData, "publishedAt");
  const publishedAt = publishAtLocal ? istanbulLocalToIso(publishAtLocal) : null;
  if (publishAtLocal && !publishedAt) return { error: "Yayın tarihi geçersiz." };

  let faq: unknown = [];
  try {
    faq = JSON.parse(text(formData, "faq") || "[]");
  } catch {
    return { error: "Sık sorulan sorular okunamadı, sayfayı yenileyip tekrar deneyin." };
  }
  const body = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    excerpt: text(formData, "excerpt"),
    summary: text(formData, "summary"),
    content: String(formData.get("content") ?? ""),
    faq,
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    noindex: formData.get("noindex") === "on",
    // "Taslak olarak kaydet" yayındaki yazıyı yayından kaldırır; "Yayınla" yayınlar ya da zamanlar
    status: intent === "publish" ? "PUBLISHED" : "DRAFT",
    publishedAt,
    markUpdated: formData.get("markUpdated") === "on",
    coverKey: text(formData, "coverKey"),
    coverAlt: text(formData, "coverAlt"),
    categoryId: text(formData, "categoryId"),
    authorId: text(formData, "authorId"),
  };
  const result = await run(
    async () =>
      apiFetch<AdminBlogPost>(id ? `/admin/blog/posts/${encodeURIComponent(id)}` : "/admin/blog/posts", {
        method: id ? "PATCH" : "POST",
        token: await adminToken(),
        body,
      }),
    "Yazı kaydedilemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  const post = result.data;
  // Yayındaki yazı Bing'e bildirilir; taslağa alınan yazının adresi de (artık açılmadığı öğrenilsin)
  if (post.state !== "scheduled" && !post.noindex) notifyIndexNow([postPath(post), BLOG_PATH]);
  if (!id) redirect(`/yonetim/blog/${post.id}?kaydedildi=${post.state}`);
  const notice =
    post.state === "published"
      ? "Yazı yayında; sitedeki sayfa güncellendi."
      : post.state === "scheduled"
        ? "Yazı zamanlandı; yayın saatinde sitede görünecek."
        : "Taslak kaydedildi; sitede görünmüyor.";
  return { notice };
}

export async function deletePost(id: string): Promise<BlogActionState> {
  const result = await run(
    async () => apiFetch(`/admin/blog/posts/${encodeURIComponent(id)}`, { method: "DELETE", token: await adminToken() }),
    "Yazı silinemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  redirect("/yonetim/blog?silindi=1");
}

/** Editördeki önizleme: sitede göründüğü gibi (aynı dönüştürme ve temizleme) */
export async function previewContent(content: string): Promise<string> {
  await adminToken();
  return renderContent(content.slice(0, 200_000));
}

// ─── Kategoriler ve yazarlar ───────────────────────────────────

export async function saveCategory(id: string | null, _prev: BlogActionState, formData: FormData): Promise<BlogActionState> {
  const body = {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    sortOrder: Number(text(formData, "sortOrder") || 0),
  };
  const result = await run(
    async () =>
      apiFetch(id ? `/admin/blog/categories/${encodeURIComponent(id)}` : "/admin/blog/categories", {
        method: id ? "PATCH" : "POST",
        token: await adminToken(),
        body,
      }),
    "Kategori kaydedilemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  return { notice: id ? "Kategori güncellendi." : "Kategori eklendi." };
}

export async function deleteCategory(id: string): Promise<BlogActionState> {
  const result = await run(
    async () => apiFetch(`/admin/blog/categories/${encodeURIComponent(id)}`, { method: "DELETE", token: await adminToken() }),
    "Kategori silinemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  return { notice: "Kategori silindi; yazıları kategorisiz kaldı." };
}

export async function saveAuthor(id: string | null, _prev: BlogActionState, formData: FormData): Promise<BlogActionState> {
  const body = {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    jobTitle: text(formData, "jobTitle"),
    bio: text(formData, "bio"),
    photoKey: text(formData, "photoKey"),
    sameAs: text(formData, "sameAs")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const result = await run(
    async () =>
      apiFetch(id ? `/admin/blog/authors/${encodeURIComponent(id)}` : "/admin/blog/authors", {
        method: id ? "PATCH" : "POST",
        token: await adminToken(),
        body,
      }),
    "Yazar kaydedilemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  return { notice: id ? "Yazar güncellendi." : "Yazar eklendi." };
}

export async function deleteAuthor(id: string): Promise<BlogActionState> {
  const result = await run(
    async () => apiFetch(`/admin/blog/authors/${encodeURIComponent(id)}`, { method: "DELETE", token: await adminToken() }),
    "Yazar silinemedi.",
  );
  if (!result.ok) return { error: result.error };
  refreshSite();
  return { notice: "Yazar silindi; yazıları imzasız kaldı." };
}

// ─── Görseller ─────────────────────────────────────────────────

type FileInfo = { mimeType: string; sizeBytes: number };

/** Büyük görsel ve önizleme için kısa süreli yükleme adresleri */
export async function prepareBlogUpload(file: FileInfo, thumb: FileInfo): Promise<Result<{ file: UploadTicket; thumb: UploadTicket }>> {
  return run(
    async () => apiFetch("/admin/blog/media/uploads", { method: "POST", token: await adminToken(), body: { file, thumb } }),
    "Yükleme başlatılamadı, lütfen tekrar deneyin.",
  );
}

export async function attachBlogMedia(input: {
  key: string;
  thumbKey: string;
  size: { width: number; height: number };
  thumbSize: { width: number; height: number };
  alt?: string;
}): Promise<Result<BlogMediaItem>> {
  return run(
    async () => apiFetch<BlogMediaItem>("/admin/blog/media", { method: "POST", token: await adminToken(), body: input }),
    "Görsel kaydedilemedi, lütfen tekrar deneyin.",
  );
}

export async function listBlogMedia(page = 1): Promise<Result<{ items: BlogMediaItem[]; total: number }>> {
  return run(
    async () => apiFetch(`/admin/blog/media?page=${page}&limit=24`, { token: await adminToken() }),
    "Görseller alınamadı.",
  );
}

export async function deleteBlogMedia(id: string): Promise<{ error?: string }> {
  const result = await run(
    async () => apiFetch(`/admin/blog/media/${encodeURIComponent(id)}`, { method: "DELETE", token: await adminToken() }),
    "Görsel silinemedi.",
  );
  return result.ok ? {} : { error: result.error };
}
