import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { SITE_URL } from "@/lib/site";
import { blogSlugify } from "./rules";

/**
 * Yazı içeriği (Markdown) → sitede güvenle gösterilecek HTML.
 * Yalnızca metin biçimi, liste, tablo, görsel ve bağlantı kalır: betik, stil, sınıf, iframe ve form gibi
 * her şey atılır. Görünüm sitenin kendi stilinden gelir.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "mark", "sup", "sub", "small", "code", "pre", "kbd",
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

/** HTML'den düz metin: kelime sayısı, açıklama alanları için */
export function htmlToText(html: string): string {
  const text = sanitizeHtml(html.replace(/<\/(p|li|h\d|div|td|th)>/gi, "</$1> "), { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Başlıklı görsel (![açıklama](adres "alt yazı")) figür olarak, alt yazısıyla gösterilir
const markdown = new Marked({
  gfm: true,
  renderer: {
    image({ href, title, text }) {
      const img = `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}">`;
      return title ? `<figure>${img}<figcaption>${escapeAttr(title)}</figcaption></figure>` : img;
    },
  },
});

/** Sitenin kendi adresine verilen tam bağlantılar göreli olur */
function rewriteHref(href: string): string {
  let url: URL;
  try {
    url = new URL(href, SITE_URL);
  } catch {
    return href;
  }
  const site = new URL(SITE_URL);
  if (url.host === site.host && /^https?:$/.test(url.protocol)) return `${url.pathname}${url.search}${url.hash}`;
  return href;
}

export type ContentImage = { width: number; height: number; thumb: { src: string; width: number; height: number } };

/**
 * İçerik HTML'i. `images`: içerikteki blog görsellerinin boyutları (sayfa kayması olmasın) ve önizlemeleri (srcset).
 * `eagerFirstImage`: kapak görseli yoksa içerikteki ilk görsel geç yüklenmesin (LCP).
 */
export function renderContent(
  source: string,
  { images = {}, eagerFirstImage = false }: { images?: Record<string, ContentImage>; eagerFirstImage?: boolean } = {},
): string {
  const raw = markdown.parse(source, { async: false });
  let imageIndex = 0;
  const clean = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel"],
      img: ["src", "srcset", "sizes", "width", "height", "alt", "loading", "decoding", "fetchpriority"],
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
        const href = attribs.href ? rewriteHref(attribs.href) : undefined;
        const external = href !== undefined && /^https?:\/\//.test(href);
        const attrs: Record<string, string> = { ...attribs, ...(href !== undefined && { href }) };
        if (external) attrs.rel = "noopener noreferrer";
        return { tagName, attribs: attrs };
      },
      img: (tagName, attribs) => {
        const eager = eagerFirstImage && imageIndex++ === 0;
        const known = attribs.src ? images[attribs.src] : undefined;
        const attrs: Record<string, string> = { src: attribs.src, alt: attribs.alt ?? "", decoding: "async" };
        if (known) {
          attrs.width = String(known.width);
          attrs.height = String(known.height);
          attrs.srcset = `${known.thumb.src} ${known.thumb.width}w, ${attribs.src} ${known.width}w`;
          attrs.sizes = "(min-width: 768px) 720px, 100vw";
        }
        if (eager) attrs.fetchpriority = "high";
        else attrs.loading = "lazy";
        return { tagName, attribs: attrs };
      },
    },
    exclusiveFilter: (frame) => (frame.tag === "img" && !frame.attribs.src) || (frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length),
  });

  const usedIds = new Set<string>();
  return (
    clean
      // Markdown görseli paragraf içine koyar: figür paragrafın içinde olamaz
      .replace(/<p>\s*(<figure>[\s\S]*?<\/figure>)\s*<\/p>/g, "$1")
      // İçindekiler için h2 başlıklarına kimlik verilir
      .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
        const base = blogSlugify(htmlToText(inner), 60) || "bolum";
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
