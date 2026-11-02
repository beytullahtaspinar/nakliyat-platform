// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports -- Next bu dosyayı CommonJS olarak yükler */
/**
 * Next.js önbelleği: varsayılan dosya önbelleği + süreçler arasında paylaşılan etiket geçersizleştirme.
 *
 * Next, updateTag/revalidatePath kayıtlarını yalnızca o isteği karşılayan Node sürecinin belleğinde tutar.
 * Sunucuda (Passenger/LiteSpeed) web birden çok süreçle çalışır ve süreçler zaman zaman yeniden başlar; yönetimde
 * kaydedilen sayfa, kaydı karşılamayan süreçlerde saatlerce eski haliyle sunuluyordu. Burada her geçersizleştirme
 * .next/cache altındaki ortak bir dosyaya da yazılır ve her süreç önbellekten okumadan önce dosyadaki yeni
 * kayıtları kendi belleğine alır. Sayfa ve fetch dosyaları zaten ortak diskte (.next/server, .next/cache).
 *
 * İkinci sorun: Next, önbelleğe yazılan kaydın tarihini yazma anı sayar. Bir sayfa üretimi (ör. "Sayfanı gör"
 * bağlantısının ön yüklemesi) güncellemeden önce başlayıp veriyi eski haliyle okur, updateTag'den sonra biterse
 * eski içerik "taze" diye bir saat sunuluyordu (firma fotoğraf açıklaması, yorum düzenleme). Etiketi kısa süre
 * önce geçersizleştirilmiş kayıt bu yüzden hiç yazılmaz; o süre içindeki ziyaretler sayfayı yeniden üretir.
 */
const fs = require("node:fs");
const path = require("node:path");
const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache.js").default;
const { tagsManifest } = require("next/dist/server/lib/incremental-cache/tags-manifest.external.js");

/** @typedef {{ stale?: number; expired?: number }} TagEntry */

/**
 * Bir etiket bu kadar süre önce geçersizleştirildiyse o etiketli kayıt önbelleğe yazılmaz: bu sürede başlamış bir
 * sayfa üretimi güncellemeden önceki veriyi okumuş olabilir. Sayfa üretimi bundan uzun sürmez.
 */
const RECENT_INVALIDATION_MS = 30_000;
const NEXT_CACHE_TAGS_HEADER = "x-next-cache-tags";

/** İki kaydın her alanında en yenisi */
function merge(/** @type {TagEntry | undefined} */ a, /** @type {TagEntry} */ b) {
  /** @type {TagEntry} */
  const out = { ...a };
  for (const key of /** @type {const} */ (["stale", "expired"])) {
    const value = b[key];
    if (typeof value === "number" && !(typeof out[key] === "number" && /** @type {number} */ (out[key]) >= value)) {
      out[key] = value;
    }
  }
  return out;
}

class SharedTagsCacheHandler extends FileSystemCache {
  /** @param {any} ctx */
  constructor(ctx) {
    super(ctx);
    this.tagsFile = ctx.serverDistDir ? path.join(ctx.serverDistDir, "..", "cache", "paylasilan-etiketler.json") : null;
    /** Dosyanın en son okunan hali (değişmediyse tekrar okunmaz) */
    this.seenMtime = 0;
  }

  /** @returns {Record<string, TagEntry>} */
  readFile() {
    if (!this.tagsFile) return {};
    try {
      return JSON.parse(fs.readFileSync(this.tagsFile, "utf8"));
    } catch {
      return {};
    }
  }

  /** Başka süreçlerin yazdığı geçersizleştirmeleri bu sürecin belleğine al */
  syncFromFile() {
    if (!this.tagsFile) return;
    let mtime;
    try {
      mtime = fs.statSync(this.tagsFile).mtimeMs;
    } catch {
      return;
    }
    if (mtime === this.seenMtime) return;
    this.seenMtime = mtime;
    for (const [tag, entry] of Object.entries(this.readFile())) {
      tagsManifest.set(tag, merge(tagsManifest.get(tag), entry));
    }
  }

  /** @param {...any} args */
  async get(...args) {
    this.syncFromFile();
    return super.get(...args);
  }

  /**
   * @param {string} key
   * @param {any} data
   * @param {any} ctx
   */
  async set(key, data, ctx) {
    this.syncFromFile();
    if (data && wasRecentlyInvalidated(cacheTagsOf(data, ctx), Date.now())) return;
    return super.set(key, data, ctx);
  }

  /**
   * @param {string | string[]} tags
   * @param {any} [durations]
   */
  async revalidateTag(tags, durations) {
    await super.revalidateTag(tags, durations);
    if (!this.tagsFile) return;
    const list = typeof tags === "string" ? [tags] : tags;
    if (list.length === 0) return;
    try {
      // Yazmadan hemen önce oku: aynı anda başka süreçte yapılan kayıt kaybolmasın
      const all = this.readFile();
      for (const tag of list) {
        const entry = tagsManifest.get(tag);
        if (entry) all[tag] = merge(all[tag], entry);
      }
      fs.mkdirSync(path.dirname(this.tagsFile), { recursive: true });
      const tmp = `${this.tagsFile}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(all));
      fs.renameSync(tmp, this.tagsFile);
    } catch (err) {
      console.error("Önbellek etiketi paylaşılamadı:", err);
    }
  }
}

/**
 * Kaydın etiketleri: fetch için istekteki etiketler, sayfa/route için Next'in yanıt başlığına yazdığı liste
 * (revalidatePath'in yol etiketleri dahil).
 * @param {any} data
 * @param {any} ctx
 * @returns {string[]}
 */
function cacheTagsOf(data, ctx) {
  if (data.kind === "FETCH") return [...(ctx?.tags ?? []), ...(ctx?.softTags ?? [])];
  const header = data.headers?.[NEXT_CACHE_TAGS_HEADER];
  return typeof header === "string" && header ? header.split(",") : [];
}

/**
 * @param {string[]} tags
 * @param {number} now
 */
function wasRecentlyInvalidated(tags, now) {
  return tags.some((tag) => {
    const entry = tagsManifest.get(tag);
    return [entry?.expired, entry?.stale].some(
      (at) => typeof at === "number" && at <= now && now - at < RECENT_INVALIDATION_MS,
    );
  });
}

module.exports = SharedTagsCacheHandler;
module.exports.wasRecentlyInvalidated = wasRecentlyInvalidated;
module.exports.cacheTagsOf = cacheTagsOf;
