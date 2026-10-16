import type { BlogFaqItem, BlogImage } from "./api";

/** Yönetim ekranlarının API yanıt tipleri (/admin/blog/...) */
export type BlogPostState = "draft" | "scheduled" | "published";

export const POST_STATE_LABELS: Record<BlogPostState, { label: string; tone: "neutral" | "warning" | "success" }> = {
  draft: { label: "Taslak", tone: "neutral" },
  scheduled: { label: "Zamanlandı", tone: "warning" },
  published: { label: "Yayında", tone: "success" },
};

export type AdminBlogPostRow = {
  id: string;
  slug: string;
  title: string;
  state: BlogPostState;
  publishedAt: string | null;
  updatedAt: string;
  noindex: boolean;
  hasCover: boolean;
  category: { slug: string; name: string } | null;
  author: { slug: string; name: string } | null;
};

export type AdminBlogPosts = {
  items: AdminBlogPostRow[];
  total: number;
  counts: { all: number; published: number; scheduled: number; draft: number };
};

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  summary: string | null;
  content: string;
  faq: BlogFaqItem[];
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  status: "DRAFT" | "PUBLISHED";
  state: BlogPostState;
  publishedAt: string | null;
  contentUpdatedAt: string | null;
  coverKey: string | null;
  coverAlt: string | null;
  cover: BlogImage | null;
  categoryId: string | null;
  authorId: string | null;
  oldSlugs: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminBlogCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  postCount: number;
};

export type AdminBlogAuthor = {
  id: string;
  slug: string;
  name: string;
  jobTitle: string | null;
  bio: string | null;
  photo: BlogImage | null;
  photoKey: string | null;
  sameAs: string[];
  postCount: number;
};

export type BlogMediaItem = BlogImage & { id: string; key: string; createdAt: string };
export type BlogMediaPage = { items: BlogMediaItem[]; total: number };

/** "2026-10-16T10:30" (TSİ, datetime-local) ↔ ISO */
export function istanbulLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToIstanbulLocal(iso: string | null): string {
  if (!iso) return "";
  // Türkiye 2016'dan beri yaz saati uygulamıyor: sabit UTC+3
  return new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);
}
