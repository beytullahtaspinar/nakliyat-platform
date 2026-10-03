import sanitizeHtml from "sanitize-html";
import { slugify } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

/**
 * WordPress yazı içeriğini sitede güvenle gösterilecek HTML'e çevirir.
 * Yalnızca metin biçimi, liste, tablo, görsel ve bağlantı kalır: betik, stil, sınıf, iframe ve
 * form gibi her şey atılır. Görünüm sitenin kendi stilinden gelir.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "mark", "sup", "sub", "small", "code", "pre", "kbd",
  "abbr", "cite", "q", "blockquote", "a", "ul", "ol", "li", "dl", "dt", "dd", "h2", "h3", "h4",
  "figure", "figcaption", "img", "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td",
  "details", "summary",
];

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", bull: "•", middot: "·", copy: "©",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML'den düz metin: başlık, özet, açıklama alanları için */
export function htmlToText(html: string): string {
  const text = sanitizeHtml(html.replace(/<\/(p|li|h\d|div)>/gi, "</$1> "), { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

/**
 * WordPress adresine verilen bağlantıları sitenin blog adreslerine çevirir; aynı yazı iki alan adında
 * görünmesin (cms. alt alanı arama motorlarına kapalı). Medya dosyaları WordPress'ten sunulmaya devam eder.
 */
function rewriteHref(href: string, wordpressUrl: string): string {
  let url: URL;
  try {
    url = new URL(href, wordpressUrl);
  } catch {
    return href;
  }
  const site = new URL(SITE_URL);
  if (url.host === site.host) return `${url.pathname}${url.search}${url.hash}`;
  if (url.host !== new URL(wordpressUrl).host || url.pathname.startsWith("/wp-content/")) return href;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "blog") parts.shift();
  if (parts.length === 0) return `/blog${url.hash}`;
  if (parts[0] === "category" && parts.length >= 2) return `/blog/kategori/${parts.at(-1)}${url.hash}`;
  // Kalıcı bağlantı ayarı "Yazı adı" (/yazi-adi/): son parça yazının kısa adıdır
  return `/blog/${parts.at(-1)}${url.hash}`;
}

/** Yazı içeriği. `eagerFirstImage`: öne çıkan görsel yoksa içerikteki ilk görsel geç yüklenmesin (LCP). */
export function renderContent(html: string, wordpressUrl: string, { eagerFirstImage = false } = {}): string {
  let imageIndex = 0;
  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "srcset", "sizes", "width", "height", "alt", "loading", "decoding"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      ol: ["start", "reversed"],
      abbr: ["title"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    // Sayfada tek H1 (yazı başlığı) olmalı; daha alt başlıklar h4'e toplanır
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => {
        const href = attribs.href ? rewriteHref(attribs.href, wordpressUrl) : undefined;
        const external = href !== undefined && /^https?:\/\//.test(href) && !href.startsWith(wordpressUrl);
        const attrs: Record<string, string> = { ...attribs, ...(href !== undefined && { href }) };
        if (attribs.target === "_blank" || external) attrs.rel = "noopener noreferrer";
        if (attribs.target && attribs.target !== "_blank") delete attrs.target;
        return { tagName, attribs: attrs };
      },
      img: (tagName, attribs) => {
        const eager = eagerFirstImage && imageIndex++ === 0;
        const attrs: Record<string, string> = { ...attribs, alt: attribs.alt ?? "", decoding: "async" };
        if (eager) delete attrs.loading;
        else attrs.loading = "lazy";
        return { tagName, attribs: attrs };
      },
    },
    exclusiveFilter: (frame) => (frame.tag === "img" && !frame.attribs.src) || (frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length),
  });

  const usedIds = new Set<string>();
  return (
    clean
      // İçindekiler için h2 başlıklarına kimlik verilir
      .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
        const base = slugify(htmlToText(inner)) || "bolum";
        let id = base;
        for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
        usedIds.add(id);
        return `<h2 id="${id}">${inner}</h2>`;
      })
      // Geniş tablo dar ekranda sayfayı taşırmasın: klavyeyle kaydırılabilen kap (axe: scrollable-region-focusable)
      .replace(/<table>/g, '<div class="blog-table" role="region" aria-label="Tablo" tabindex="0"><table>')
      .replace(/<\/table>/g, "</table></div>")
  );
}

/** İçindekiler: içerikteki h2 başlıkları */
export function contentHeadings(html: string): { id: string; text: string }[] {
  return [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: htmlToText(m[2]) }));
}
