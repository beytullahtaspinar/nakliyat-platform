import type { MetadataRoute } from "next";
import { apiFetch, type Paginated, type PublicCompanyListItem } from "@/lib/api";
import { BLOG_PATH, categoryPath, getAllPostSummaries, getCategories, postPath } from "@/lib/blog/wordpress";
import { HUB_PATH } from "@/lib/local-content";
import { LEGAL_LINKS } from "@/lib/legal";
import { getIndexableLocalPages } from "@/lib/local-seo";
import { MARKETING_LINKS } from "@/lib/marketing";
import { COMPANY_CACHE_TAG, companyPath } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

// Firma listesi saatte bir yenilenir
export const revalidate = 3600;

/** Yorumu olan doğrulanmış firmalar (yorumsuz firma sayfaları noindex). API'ye ulaşılamazsa boş. */
async function reviewedCompanies(): Promise<PublicCompanyListItem[]> {
  try {
    const { items } = await apiFetch<Paginated<PublicCompanyListItem>>("/companies?reviewed=true&limit=1000", {
      revalidate,
      tags: [COMPANY_CACHE_TAG],
    });
    return items;
  } catch {
    return [];
  }
}

/** Blog: yazı varsa liste, yazılar ve kategoriler. WordPress yoksa boş. */
async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getAllPostSummaries(), getCategories()]);
  if (posts.length === 0) return [];
  return [
    { url: `${SITE_URL}${BLOG_PATH}`, lastModified: posts[0].modifiedAt, changeFrequency: "daily", priority: 0.7 },
    ...posts.map((post) => ({
      url: `${SITE_URL}${postPath(post)}`,
      lastModified: post.modifiedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...categories.map((category) => ({
      url: `${SITE_URL}${categoryPath(category)}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}

// Yalnızca dizine açık sayfalar listelenir
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${HUB_PATH}`, changeFrequency: "monthly", priority: 0.9 },
    ...MARKETING_LINKS.map((link) => ({ url: `${SITE_URL}${link.href}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...getIndexableLocalPages().map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      changeFrequency: "weekly" as const,
      priority: page.kind === "city" ? 0.8 : page.kind === "district" ? 0.7 : 0.6,
    })),
    ...(await reviewedCompanies()).map((company) => ({
      url: `${SITE_URL}${companyPath(company)}`,
      lastModified: company.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...(await blogEntries()),
    ...LEGAL_LINKS.map((link) => ({ url: `${SITE_URL}${link.href}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
