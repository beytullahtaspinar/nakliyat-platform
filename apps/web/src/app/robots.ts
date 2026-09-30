import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

// Yapay zekâ arama motorlarına (GEO) bilinçli olarak izin veriyoruz:
// ChatGPT, Claude, Perplexity ve Google AI yanıtlarında kaynak gösterilebilmek için.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
