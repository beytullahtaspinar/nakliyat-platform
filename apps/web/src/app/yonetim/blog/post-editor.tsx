"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { clearDraft, parseDraft, readDraftText, writeDraft } from "./draft-backup";
import { FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { previewContent, savePost } from "@/lib/actions/blog";
import {
  isoToIstanbulLocal,
  POST_STATE_LABELS,
  type AdminBlogAuthor,
  type AdminBlogCategory,
  type AdminBlogPost,
} from "@/lib/blog/admin";
import { BLOG_PROSE } from "@/lib/blog/prose";
import {
  BLOG_PATH,
  BLOG_RULES,
  SEO_DESCRIPTION_IDEAL,
  SEO_TITLE_IDEAL,
  blogSlugify,
  postPath,
} from "@/lib/blog/rules";
import type { BlogFaqItem, BlogImage } from "@/lib/blog/api";
import { SITE_NAME } from "@/lib/site";
import { ImagePicker } from "./image-picker";

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-sm font-medium text-slate-800";
const hint = "mt-1 block text-xs text-slate-500";
// Yedek okuma deposu değişmez; yalnızca açılışta okunur (useSyncExternalStore için sabit abonelik)
const noSubscribe = () => () => {};
const toolButton =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50";

/** Karakter sayacı: sınır aşılınca ya da önerilen aralık dışında uyarı renginde */
function Counter({ value, max, ideal }: { value: string; max: number; ideal?: { min?: number; max: number } }) {
  const n = value.length;
  const warn = n > max || (ideal && n > 0 && (n > ideal.max || (ideal.min !== undefined && n < ideal.min)));
  return (
    <span className={`text-xs tabular-nums ${warn ? "font-semibold text-amber-800" : "text-slate-500"}`}>
      {n}/{ideal ? `${ideal.min ? `${ideal.min}-` : ""}${ideal.max}` : max}
    </span>
  );
}

type Check = { ok: boolean; text: string };

/** Yayın öncesi SEO/GEO kontrolleri: hepsi zorunlu değil, eksikler sarı görünür */
function seoChecks(f: {
  title: string;
  excerpt: string;
  summary: string;
  content: string;
  seoDescription: string;
  cover: BlogImage | null;
  coverAlt: string;
  faq: BlogFaqItem[];
  categoryId: string;
  authorId: string;
}): Check[] {
  const words = f.content.replace(/[#>*_`[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  const subheadings = (f.content.match(/^##\s+\S/gm) ?? []).length;
  const imagesWithoutAlt = (f.content.match(/!\[\s*\]\(/g) ?? []).length;
  const internalLinks = (f.content.match(/\]\((\/|https:\/\/evdenevenakliyat\.app)/g) ?? []).length;
  const description = f.seoDescription || f.excerpt;
  return [
    { ok: f.title.length >= 20 && f.title.length <= SEO_TITLE_IDEAL + 10, text: "Başlık 20-70 karakter ve aranan soruyu içeriyor" },
    { ok: f.summary.trim().length >= 80, text: "\"Kısaca\" kutusunda sorunun 2-3 cümlelik net cevabı var" },
    { ok: words >= 300, text: `İçerik en az 300 kelime (şu an ${words})` },
    { ok: subheadings >= 2, text: "En az 2 ara başlık (##) ile bölümlere ayrılmış" },
    { ok: !/^#\s/m.test(f.content), text: "İçerikte tek # (H1) yok; yazı başlığı tek H1" },
    { ok: internalLinks >= 1, text: "Sitenin başka bir sayfasına bağlantı var (ör. il sayfası, fiyat hesaplama)" },
    { ok: imagesWithoutAlt === 0, text: imagesWithoutAlt ? `${imagesWithoutAlt} içerik görselinin açıklaması (alt metin) eksik` : "İçerik görsellerinin açıklaması var" },
    { ok: !!f.cover && f.coverAlt.trim().length > 0, text: "Kapak görseli ve açıklaması var" },
    {
      ok: description.length >= SEO_DESCRIPTION_IDEAL.min && description.length <= SEO_DESCRIPTION_IDEAL.max,
      text: `Arama açıklaması ${SEO_DESCRIPTION_IDEAL.min}-${SEO_DESCRIPTION_IDEAL.max} karakter`,
    },
    { ok: f.faq.length >= 2, text: "En az 2 sık sorulan soru (Google ve yapay zekâ yanıtlarında soru-cevap olarak görünür)" },
    { ok: !!f.categoryId && !!f.authorId, text: "Kategori ve yazar seçilmiş" },
  ];
}

export function PostEditor({
  post,
  categories,
  authors,
  savedNotice,
}: {
  post: AdminBlogPost | null;
  categories: AdminBlogCategory[];
  authors: AdminBlogAuthor[];
  savedNotice?: string;
}) {
  const ids = { title: useId(), slug: useId(), excerpt: useId(), summary: useId(), content: useId(), seoTitle: useId(), seoDescription: useId(), category: useId(), author: useId() };
  const { state, pending, invalid, formProps } = useFormAction(savePost.bind(null, post?.id ?? null), {});
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  // Yayınlanmamış yazının adresi başlıktan kendiliğinden üretilir (elle değiştirilene kadar)
  const [slugTouched, setSlugTouched] = useState(!!post?.publishedAt);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [faq, setFaq] = useState<BlogFaqItem[]>(post?.faq ?? []);
  const [cover, setCover] = useState<BlogImage | null>(post?.cover ?? null);
  const [coverKey, setCoverKey] = useState(post?.coverKey ?? "");
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? "");
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "");
  const [authorId, setAuthorId] = useState(post?.authorId ?? (authors.length === 1 ? authors[0].id : ""));
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Yazının tarayıcıdaki yedeği: değişiklikte yazılır, başarılı kayıtta silinir. Açılışta yedek varsa sorulur.
  const postId = post?.id ?? null;
  const draftValues = { title, slug, excerpt, summary, content, seoTitle, seoDescription, faq, cover, coverKey, coverAlt, categoryId, authorId };
  const draftText = useSyncExternalStore(noSubscribe, () => readDraftText(postId), () => null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const draft = draftText && !draftDismissed ? parseDraft(draftText, post?.updatedAt) : null;
  const restoreDraft = () => {
    if (!draft) return;
    const v = draft as Partial<typeof draftValues>;
    if (typeof v.title === "string") setTitle(v.title);
    if (typeof v.slug === "string") setSlug(v.slug);
    if (typeof v.excerpt === "string") setExcerpt(v.excerpt);
    if (typeof v.summary === "string") setSummary(v.summary);
    if (typeof v.content === "string") setContent(v.content);
    if (typeof v.seoTitle === "string") setSeoTitle(v.seoTitle);
    if (typeof v.seoDescription === "string") setSeoDescription(v.seoDescription);
    if (Array.isArray(v.faq)) setFaq(v.faq);
    if (v.cover === null || (v.cover && typeof v.cover === "object")) setCover(v.cover ?? null);
    if (typeof v.coverKey === "string") setCoverKey(v.coverKey);
    if (typeof v.coverAlt === "string") setCoverAlt(v.coverAlt);
    if (typeof v.categoryId === "string") setCategoryId(v.categoryId);
    if (typeof v.authorId === "string") setAuthorId(v.authorId);
    setDraftDismissed(true);
    setDirty(true);
  };
  useEffect(() => {
    // Kayıt yapılıp sayfa yenilendiyse (yeni yazıda yönlendirme sonrası) yedek artık eski
    if (savedNotice) {
      clearDraft(null);
      clearDraft(postId);
    }
  }, [savedNotice, postId]);
  useEffect(() => {
    if (!dirty) return;
    writeDraft(postId, draftValues);
    // draftValues her oluşturulduğunda yeni nesne; alanların kendisi izleniyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, postId, title, slug, excerpt, summary, content, seoTitle, seoDescription, faq, cover, coverKey, coverAlt, categoryId, authorId]);

  // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa tarayıcı uyarır
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Kayıt başarılıysa değişiklikler kaydedilmiş sayılır
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.notice) {
      setDirty(false);
      clearDraft(postId);
    }
  }

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  const onTitle = (value: string) => {
    change(setTitle)(value);
    if (!slugTouched) setSlug(blogSlugify(value));
  };

  /** Seçili metni sarar ya da imlecin yerine ekler; imleç eklenen metnin içine konur */
  const insert = (before: string, after = "", placeholder = "") => {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    change(setContent)(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  /** Satır başına eklenen biçimler (başlık, liste, alıntı) */
  const insertLine = (prefix: string, placeholder: string) => {
    const el = textarea.current;
    const start = el?.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const needsBreak = lineStart !== start;
    insert(`${needsBreak ? "\n\n" : ""}${prefix}`, "", placeholder);
  };

  const showPreview = async () => {
    setTab("preview");
    setPreviewHtml(null);
    setPreviewHtml(await previewContent(content));
  };

  const checks = seoChecks({ title, excerpt, summary, content, seoDescription, cover, coverAlt, faq, categoryId, authorId });
  const passed = checks.filter((c) => c.ok).length;
  const state_ = post ? POST_STATE_LABELS[post.state] : null;
  const googleTitle = `${seoTitle || title || "Yazı başlığı"} | ${SITE_NAME}`;
  const googleDescription = seoDescription || excerpt || "Arama sonuçlarında görünecek açıklama.";

  return (
    <form {...formProps} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]" onChange={() => setDirty(true)}>
      <input type="hidden" name="faq" value={JSON.stringify(faq.filter((f) => f.question.trim() || f.answer.trim()))} />
      <input type="hidden" name="coverKey" value={coverKey} />

      <div className="min-w-0 space-y-5">
        {savedNotice && !state.notice && !state.error && (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {savedNotice}
          </p>
        )}
        <div className={`${card} space-y-4`}>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.title} className={label}>
                Başlık
              </label>
              <Counter value={title} max={BLOG_RULES.titleMax} ideal={{ min: 20, max: SEO_TITLE_IDEAL + 10 }} />
            </div>
            <input
              id={ids.title}
              name="title"
              required
              minLength={5}
              maxLength={BLOG_RULES.titleMax}
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              className={`${inputClass} text-lg font-semibold`}
              placeholder="Ör. Evden eve nakliyat fiyatları 2026: ev tipine göre ortalama ücretler"
            />
            <span className={hint}>Okurun Google&apos;a yazacağı soruyu içersin. Sayfadaki tek ana başlık (H1) budur.</span>
          </div>

          <div>
            <label htmlFor={ids.slug} className={label}>
              Adres
            </label>
            <div className="mt-1 flex min-w-0 items-center rounded-lg border border-zinc-300 bg-white focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-700/20">
              <span className="shrink-0 pl-3 text-sm text-slate-500">{BLOG_PATH}/</span>
              <input
                id={ids.slug}
                name="slug"
                value={slug}
                maxLength={BLOG_RULES.slugMax}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                onChange={(e) => {
                  setSlugTouched(true);
                  change(setSlug)(e.target.value.toLowerCase());
                }}
                className="min-w-0 flex-1 rounded-r-lg bg-transparent px-1 py-2 text-base text-zinc-900 focus:outline-none"
              />
            </div>
            <span className={hint}>
              Kısa ve anahtar kelimeli olsun. Yayındaki yazının adresi değişirse eski adres yenisine yönlenir.
              {post && post.oldSlugs.length > 0 && ` Eski adresler: ${post.oldSlugs.join(", ")}.`}
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.excerpt} className={label}>
                Özet
              </label>
              <Counter value={excerpt} max={BLOG_RULES.excerptMax} ideal={{ min: BLOG_RULES.excerptMin, max: SEO_DESCRIPTION_IDEAL.max }} />
            </div>
            <textarea
              id={ids.excerpt}
              name="excerpt"
              rows={2}
              maxLength={BLOG_RULES.excerptMax}
              value={excerpt}
              onChange={(e) => change(setExcerpt)(e.target.value)}
              className={inputClass}
            />
            <span className={hint}>Blog listesindeki kartta görünür; arama açıklaması boşsa Google&apos;da da bu görünür.</span>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.summary} className={label}>
                Kısaca (net cevap)
              </label>
              <Counter value={summary} max={BLOG_RULES.summaryMax} />
            </div>
            <textarea
              id={ids.summary}
              name="summary"
              rows={3}
              maxLength={BLOG_RULES.summaryMax}
              value={summary}
              onChange={(e) => change(setSummary)(e.target.value)}
              className={inputClass}
              placeholder="Ör. 2+1 bir evin İstanbul içinde taşınması 2026'da ortalama 18.000-26.000 TL tutuyor. Fiyatı en çok kat, asansör ve paketleme belirliyor."
            />
            <span className={hint}>
              Yazının en başında kutu içinde görünür. Sorunun cevabını 2-3 cümlede, rakam varsa rakamla ver: ChatGPT ve Google
              yapay zekâ yanıtları çoğunlukla buradan alıntılar.
            </span>
          </div>
        </div>

        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={ids.content} className={label}>
              İçerik
            </label>
            <div role="tablist" aria-label="İçerik görünümü" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "write"}
                onClick={() => setTab("write")}
                className={`rounded-md px-3 py-1 font-medium ${tab === "write" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Yaz
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "preview"}
                onClick={showPreview}
                className={`rounded-md px-3 py-1 font-medium ${tab === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Önizle
              </button>
            </div>
          </div>

          <div className={tab === "write" ? "" : "hidden"}>
            <div className="mt-3 flex flex-wrap gap-1.5" role="toolbar" aria-label="Biçimlendirme">
              <button type="button" className={toolButton} onClick={() => insertLine("## ", "Ara başlık")}>
                Başlık
              </button>
              <button type="button" className={toolButton} onClick={() => insertLine("### ", "Alt başlık")}>
                Alt başlık
              </button>
              <button type="button" className={toolButton} onClick={() => insert("**", "**", "kalın metin")}>
                <strong>K</strong>
                <span className="sr-only">alın</span>
              </button>
              <button type="button" className={toolButton} onClick={() => insert("_", "_", "eğik metin")}>
                <em>E</em>
                <span className="sr-only">ğik</span>
              </button>
              <button type="button" className={toolButton} onClick={() => insert("[", "](/talep-olustur)", "bağlantı metni")}>
                Bağlantı
              </button>
              <button type="button" className={toolButton} onClick={() => insertLine("- ", "Madde")}>
                Liste
              </button>
              <button type="button" className={toolButton} onClick={() => insertLine("1. ", "Adım")}>
                Numaralı liste
              </button>
              <button type="button" className={toolButton} onClick={() => insertLine("> ", "Önemli not")}>
                Alıntı
              </button>
              <button
                type="button"
                className={toolButton}
                onClick={() => insertLine("| Ev tipi | Ortalama fiyat |\n| --- | --- |\n| 1+1 | ", "… TL |")}
              >
                Tablo
              </button>
            </div>
            <textarea
              ref={textarea}
              id={ids.content}
              name="content"
              rows={24}
              value={content}
              onChange={(e) => change(setContent)(e.target.value)}
              className={`${inputClass} font-mono text-[0.95rem] leading-7`}
              placeholder={"İlk paragrafta sorunun cevabını ver.\n\n## İlk ara başlık\n\nMetin…"}
            />
            <div className="mt-3">
              <ImagePicker
                uploadLabel="İçeriğe görsel ekle"
                onSelect={(item) => insertLine(`![${item.alt}](${item.src})`, "")}
              />
            </div>
            <details className="mt-3 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">Yazım kısayolları</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <code>## Başlık</code> ara başlık, <code>### Başlık</code> alt başlık. Tek <code>#</code> kullanma.
                </li>
                <li>
                  <code>**kalın**</code>, <code>_eğik_</code>, <code>[metin](/adres)</code> bağlantı, <code>- madde</code> liste
                </li>
                <li>
                  Görsel: <code>![açıklama](/medya/blog/…)</code>; alt yazı için <code>![açıklama](adres &quot;alt yazı&quot;)</code>
                </li>
                <li>Paragraflar arasında bir boş satır bırak.</li>
              </ul>
            </details>
          </div>

          {tab === "preview" && (
            <div className="mt-3 min-h-40 rounded-lg border border-slate-200 p-4 sm:p-6">
              {previewHtml === null ? (
                <p className="text-sm text-slate-600">Önizleme hazırlanıyor…</p>
              ) : previewHtml ? (
                <div className={`${BLOG_PROSE} !mt-0`} dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-sm text-slate-600">İçerik boş.</p>
              )}
            </div>
          )}
        </div>

        <FaqEditor faq={faq} onChange={change(setFaq)} />
      </div>

      <aside className="min-w-0 space-y-5">
        <div className={`${card} space-y-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Yayın</h2>
            {state_ && <Badge tone={state_.tone}>{state_.label}</Badge>}
          </div>
          <label className="block">
            <span className={label}>Yayın tarihi (TSİ)</span>
            <input
              type="datetime-local"
              name="publishedAt"
              defaultValue={isoToIstanbulLocal(post?.publishedAt ?? null)}
              className={inputClass}
            />
            <span className={hint}>Boşsa &quot;Yayınla&quot;ya basınca hemen yayınlanır. İleri bir tarih verirsen o saatte yayınlanır.</span>
          </label>
          {post?.state === "published" && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" name="markUpdated" className="mt-0.5 h-4 w-4 accent-brand-700" />
              <span>
                Önemli güncelleme
                <span className={hint}>Bilgiler değiştiyse işaretle; sayfada ve Google&apos;da &quot;güncellendi&quot; tarihi görünür.</span>
              </span>
            </label>
          )}
          {draft && !state.notice && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>Bu tarayıcıda kaydedilmemiş bir taslak var.</span>
              <button type="button" onClick={restoreDraft} className="font-semibold underline">
                Taslağı geri yükle
              </button>
              <button type="button" onClick={() => setDraftDismissed(true)} className="underline">
                Yoksay
              </button>
            </div>
          )}
          <FormError message={state.error ?? invalid} />
          {state.notice && (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              {state.notice}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button type="submit" name="intent" value="publish" disabled={pending}>
              {pending ? "Kaydediliyor…" : post?.state === "published" ? "Güncelle" : "Yayınla"}
            </Button>
            <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
              {post?.state === "published" ? "Yayından kaldır (taslak)" : "Taslak olarak kaydet"}
            </Button>
          </div>
          {post?.state === "published" && (
            <Link href={postPath(post)} target="_blank" className="block text-sm font-medium text-brand-700 hover:underline">
              Sitede gör ↗
            </Link>
          )}
        </div>

        <div className={`${card} space-y-4`}>
          <h2 className="font-semibold text-slate-900">Kategori ve yazar</h2>
          <div>
            <label htmlFor={ids.category} className={label}>
              Kategori
            </label>
            <select id={ids.category} name="categoryId" value={categoryId} onChange={(e) => change(setCategoryId)(e.target.value)} className={inputClass}>
              <option value="">Kategorisiz</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.author} className={label}>
              Yazar
            </label>
            <select id={ids.author} name="authorId" value={authorId} onChange={(e) => change(setAuthorId)(e.target.value)} className={inputClass}>
              <option value="">İmzasız (site adına)</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {(categories.length === 0 || authors.length === 0) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {categories.length === 0 && authors.length === 0
                ? "Henüz kategori ve yazar eklenmemiş."
                : categories.length === 0
                  ? "Henüz kategori eklenmemiş."
                  : "Henüz yazar eklenmemiş."}{" "}
              Aşağıdaki bağlantıdan ekleyip bu sayfaya dönün; yazdıklarınız bu tarayıcıda saklanır, geri yükleyebilirsiniz.
            </p>
          )}
          <p className="text-xs text-slate-500">
            <Link href="/yonetim/blog/kategoriler" className="font-medium text-brand-700 hover:underline">
              Kategoriler
            </Link>{" "}
            ·{" "}
            <Link href="/yonetim/blog/yazarlar" className="font-medium text-brand-700 hover:underline">
              Yazarlar
            </Link>
          </p>
        </div>

        <div className={`${card} space-y-3`}>
          <h2 className="font-semibold text-slate-900">Kapak görseli</h2>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.thumb.src} alt="" className="aspect-[16/9] w-full rounded-lg bg-slate-100 object-cover" />
          ) : (
            <p className="text-sm text-slate-600">Yatay (16:9) bir fotoğraf seç; listede, yazının başında ve paylaşımlarda görünür.</p>
          )}
          <ImagePicker
            uploadLabel={cover ? "Değiştir" : "Görsel yükle"}
            onSelect={(item) => {
              setCover(item);
              setCoverKey(item.key);
              if (!coverAlt && item.alt) setCoverAlt(item.alt);
              setDirty(true);
            }}
          />
          {cover && (
            <>
              <label className="block">
                <span className={label}>Görsel açıklaması (alt metin)</span>
                <input
                  name="coverAlt"
                  value={coverAlt}
                  maxLength={BLOG_RULES.coverAltMax}
                  onChange={(e) => change(setCoverAlt)(e.target.value)}
                  className={inputClass}
                  placeholder="Ör. Kamyona yüklenen koliler ve beyaz eşya"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setCover(null);
                  setCoverKey("");
                  setCoverAlt("");
                  setDirty(true);
                }}
                className="text-sm font-medium text-red-700 hover:underline"
              >
                Kapak görselini kaldır
              </button>
            </>
          )}
        </div>

        <div className={`${card} space-y-4`}>
          <h2 className="font-semibold text-slate-900">Arama motoru (SEO)</h2>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.seoTitle} className={label}>
                SEO başlığı
              </label>
              <Counter value={seoTitle} max={BLOG_RULES.seoTitleMax} ideal={{ max: SEO_TITLE_IDEAL }} />
            </div>
            <input
              id={ids.seoTitle}
              name="seoTitle"
              value={seoTitle}
              maxLength={BLOG_RULES.seoTitleMax}
              onChange={(e) => change(setSeoTitle)(e.target.value)}
              className={inputClass}
              placeholder="Boşsa başlık kullanılır"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.seoDescription} className={label}>
                Arama açıklaması
              </label>
              <Counter value={seoDescription} max={BLOG_RULES.seoDescriptionMax} ideal={SEO_DESCRIPTION_IDEAL} />
            </div>
            <textarea
              id={ids.seoDescription}
              name="seoDescription"
              rows={3}
              value={seoDescription}
              maxLength={BLOG_RULES.seoDescriptionMax}
              onChange={(e) => change(setSeoDescription)(e.target.value)}
              className={inputClass}
              placeholder="Boşsa özet kullanılır"
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3" aria-label="Google önizlemesi">
            <p className="text-xs text-slate-500">Google&apos;da yaklaşık görünüm</p>
            <p className="mt-1 truncate text-xs text-slate-600">evdenevenakliyat.app › blog › {slug || "adres"}</p>
            <p className="line-clamp-1 text-base text-[#1a0dab]">{googleTitle}</p>
            <p className="line-clamp-2 text-sm text-slate-700">{googleDescription}</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input type="checkbox" name="noindex" defaultChecked={post?.noindex} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              Arama motorlarına kapalı
              <span className={hint}>Yalnızca kampanya duyurusu gibi geçici yazılar için.</span>
            </span>
          </label>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-slate-900">
            SEO ve GEO kontrolü{" "}
            <span className="text-sm font-medium text-slate-600">
              ({passed}/{checks.length})
            </span>
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.text} className="flex gap-2">
                <span aria-hidden className={c.ok ? "text-green-700" : "text-amber-700"}>
                  {c.ok ? "✓" : "•"}
                </span>
                <span className={c.ok ? "text-slate-600" : "text-slate-900"}>
                  <span className="sr-only">{c.ok ? "Tamam: " : "Eksik: "}</span>
                  {c.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </form>
  );
}

/** Sık sorulan sorular: sayfada soru-cevap olarak ve FAQPage yapısal verisinde görünür */
function FaqEditor({ faq, onChange }: { faq: BlogFaqItem[]; onChange: (faq: BlogFaqItem[]) => void }) {
  const update = (index: number, patch: Partial<BlogFaqItem>) => onChange(faq.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <div className={card}>
      <h2 className="font-semibold text-slate-900">Sık sorulan sorular</h2>
      <p className="mt-1 text-sm text-slate-600">
        Okurların gerçekten sorduğu soruları yaz, cevabı ilk cümlede ver. Yazının sonunda ve Google&apos;ın soru-cevap verisinde görünür.
      </p>
      <ol className="mt-4 space-y-4">
        {faq.map((f, i) => (
          <li key={i} className="rounded-lg border border-slate-200 p-3">
            <label className="block">
              <span className={label}>Soru {i + 1}</span>
              <input
                value={f.question}
                maxLength={BLOG_RULES.faqQuestionMax}
                onChange={(e) => update(i, { question: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="mt-2 block">
              <span className={label}>Cevap</span>
              <textarea
                value={f.answer}
                rows={3}
                maxLength={BLOG_RULES.faqAnswerMax}
                onChange={(e) => update(i, { answer: e.target.value })}
                className={inputClass}
              />
            </label>
            <button type="button" onClick={() => onChange(faq.filter((_, j) => j !== i))} className="mt-2 text-sm font-medium text-red-700 hover:underline">
              Soruyu kaldır
            </button>
          </li>
        ))}
      </ol>
      {faq.length < BLOG_RULES.faqMax && (
        <button
          type="button"
          onClick={() => onChange([...faq, { question: "", answer: "" }])}
          className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Soru ekle
        </button>
      )}
    </div>
  );
}
