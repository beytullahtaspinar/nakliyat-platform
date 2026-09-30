import type { MetadataRoute } from "next";
import { HUB_PATH } from "@/lib/local-content";
import { getIndexableLocalPages } from "@/lib/local-seo";
import { SITE_URL } from "@/lib/site";

// Yalnızca dizine açık sayfalar listelenir. Firma profilleri ve blog yazıları eklendikçe buraya eklenecek.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${HUB_PATH}`, changeFrequency: "monthly", priority: 0.9 },
    ...getIndexableLocalPages().map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      changeFrequency: "weekly" as const,
      priority: page.kind === "city" ? 0.8 : page.kind === "district" ? 0.7 : 0.6,
    })),
  ];
}
