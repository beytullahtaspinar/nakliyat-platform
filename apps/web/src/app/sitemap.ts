import type { MetadataRoute } from "next";
import { apiFetch, type Paginated, type PublicCompanyListItem } from "@/lib/api";
import { BLOG_PATH, authorPath, categoryPath, getBlogIndex, postPath } from "@/lib/blog/api";
import { HUB_PATH } from "@/lib/local-content";
import { LEGAL_LINKS } from "@/lib/legal";
import { getIndexableLocalPages } from "@/lib/local-seo";
import { MARKETING_LINKS } from "@/lib/marketing";
import { COMPANY_CACHE_TAG, companyPath } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

// Firma listesi saatte bir yenilenir
export const revalidate = 3600;

/** Arama motoruna açık firma sayfaları (yorumu olan ya da tanıtımı dolu). API'ye ulaşılamazsa boş. */
async function indexableCompanies(): Promise<PublicCompanyListItem[]> {
  try {
    const { items } = await apiFetch<Paginated<PublicCompanyListItem>>("/companies?indexable=true&limit=1000", {
      revalidate,
      tags: [COMPANY_CACHE_TAG],
    });
    return items;
  } catch {
    return [];
  }
}

/** Blog: yazı varsa liste, yazılar (kapak görseliyle), kategoriler ve yazarlar. Dizine kapalı yazılar listelenmez. */
async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  const { posts, categories, authors } = await getBlogIndex();
  const indexable = posts.filter((p) => !p.noindex);
  if (indexable.length === 0) return [];
  return [
    { url: `${SITE_URL}${BLOG_PATH}`, lastModified: indexable[0].lastModified, changeFrequency: "daily", priority: 0.7 },
    ...indexable.map((post) => ({
      url: `${SITE_URL}${postPath(post)}`,
      lastModified: post.lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      ...(post.cover && { images: [`${SITE_URL}${post.cover.src}`] }),
    })),
    ...categories.map((category) => ({
      url: `${SITE_URL}${categoryPath(category)}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...authors.map((author) => ({
      url: `${SITE_URL}${authorPath(author)}`,
      lastModified: author.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.4,
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
    ...(await indexableCompanies()).map((company) => ({
      url: `${SITE_URL}${companyPath(company)}`,
      lastModified: company.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...(await blogEntries()),
    ...LEGAL_LINKS.map((link) => ({ url: `${SITE_URL}${link.href}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
