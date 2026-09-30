import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Şehir sayfaları, firma profilleri ve blog yazıları eklendikçe buraya dinamik olarak eklenecek.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
  ];
}
