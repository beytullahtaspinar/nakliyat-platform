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
 */
const fs = require("node:fs");
const path = require("node:path");
const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache.js").default;
const { tagsManifest } = require("next/dist/server/lib/incremental-cache/tags-manifest.external.js");

/** @typedef {{ stale?: number; expired?: number }} TagEntry */

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

module.exports = SharedTagsCacheHandler;
