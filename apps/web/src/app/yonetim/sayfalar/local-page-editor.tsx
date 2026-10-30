"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { previewContent } from "@/lib/actions/blog";
import { resetLocalPage, saveLocalPage, type LocalPageActionState } from "@/lib/actions/local-pages";
import type { BlogFaqItem, BlogImage } from "@/lib/blog/api";
import { BLOG_PROSE } from "@/lib/blog/prose";
import { BLOG_RULES, SEO_DESCRIPTION_IDEAL, SEO_TITLE_IDEAL } from "@/lib/blog/rules";
import type { EditablePage } from "@/lib/local-page-admin";
import { LOCAL_PAGE_RULES, type LocalPageContent } from "@/lib/local-page-content";
import { SITE_NAME } from "@/lib/site";
import { Counter, FaqEditor } from "../blog/post-editor";
import { ImagePicker } from "../blog/image-picker";

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-sm font-medium text-slate-800";
const hint = "mt-1 block text-xs text-slate-500";
const toolButton =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50";

/**
 * Bölge sayfası düzenleyici. Her alan isteğe bağlı: boş bırakılan alanda yer tutucudaki otomatik metin kullanılır.
 * Fiyat tablosu, firmalar ve yorumlar canlı veriden geldiği için burada yok.
 */
export function LocalPageEditor({ page, content }: { page: EditablePage; content: LocalPageContent | null }) {
  const ids = {
    seoTitle: useId(),
    seoDescription: useId(),
    heading: useId(),
    intro: useId(),
    content: useId(),
  };
  const [seoTitle, setSeoTitle] = useState(content?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(content?.seoDescription ?? "");
  const [heading, setHeading] = useState(content?.heading ?? "");
  const [intro, setIntro] = useState(content?.intro ?? "");
  const [body, setBody] = useState(content?.content ?? "");
  const [faq, setFaq] = useState<BlogFaqItem[]>(content?.faq ?? []);
  const [cover, setCover] = useState<BlogImage | null>(content?.cover ?? null);
  const [coverKey, setCoverKey] = useState(content?.coverKey ?? "");
  const [coverAlt, setCoverAlt] = useState(content?.cover?.alt ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { state, pending, invalid, formProps } = useFormAction<LocalPageActionState>(saveLocalPage.bind(null, page.slug), {});
  const [resetState, setResetState] = useState<LocalPageActionState>({});
  const [resetting, startReset] = useTransition();

  // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa tarayıcı uyarır
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.notice) setDirty(false);
  }

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  /** Seçili metni sarar ya da imlecin yerine ekler */
  const insert = (before: string, after = "", placeholder = "") => {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    change(setBody)(body.slice(0, start) + before + selected + after + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const insertLine = (prefix: string, placeholder: string) => {
    const start = textarea.current?.selectionStart ?? body.length;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    insert(`${lineStart !== start ? "\n\n" : ""}${prefix}`, "", placeholder);
  };

  const showPreview = async () => {
    setTab("preview");
    setPreviewHtml(null);
    setPreviewHtml(await previewContent(body));
  };

  const reset = () => {
    if (!window.confirm("Sayfadaki tüm değişiklikler silinip otomatik metne dönülecek. Emin misin?")) return;
    startReset(async () => {
      const result = await resetLocalPage(page.slug);
      setResetState(result);
      if (result.notice) {
        setSeoTitle("");
        setSeoDescription("");
        setHeading("");
        setIntro("");
        setBody("");
        setFaq([]);
        setCover(null);
        setCoverKey("");
        setCoverAlt("");
        setDirty(false);
      }
    });
  };

  const googleTitle = `${seoTitle || page.defaults.seoTitle} | ${SITE_NAME}`;
  const googleDescription = seoDescription || page.defaults.seoDescription;
  const notice = resetState.notice ?? state.notice;
  const error = resetState.error ?? state.error ?? invalid;

  return (
    <form
      {...formProps}
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"
      onChange={() => {
        setDirty(true);
        setResetState({});
      }}
    >
      <input type="hidden" name="faq" value={JSON.stringify(faq.filter((f) => f.question.trim() || f.answer.trim()))} />
      <input type="hidden" name="coverKey" value={coverKey} />

      <div className="min-w-0 space-y-5">
        <div className={`${card} space-y-4`}>
          <p className="text-sm text-slate-600">
            Boş bıraktığın alanda gri yazıyla görünen otomatik metin kullanılır. Fiyat tablosu, firmalar ve yorumlar canlı
            veriden gelir.
          </p>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.heading} className={label}>
                Sayfa başlığı (H1)
              </label>
              <Counter value={heading} max={LOCAL_PAGE_RULES.headingMax} />
            </div>
            <input
              id={ids.heading}
              name="heading"
              value={heading}
              maxLength={LOCAL_PAGE_RULES.headingMax}
              onChange={(e) => change(setHeading)(e.target.value)}
              className={`${inputClass} text-lg font-semibold`}
              placeholder={page.defaults.heading}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.intro} className={label}>
                Giriş metni
              </label>
              <Counter value={intro} max={LOCAL_PAGE_RULES.introMax} />
            </div>
            <textarea
              id={ids.intro}
              name="intro"
              rows={5}
              maxLength={LOCAL_PAGE_RULES.introMax}
              value={intro}
              onChange={(e) => change(setIntro)(e.target.value)}
              className={inputClass}
              placeholder={page.defaults.intro}
            />
            <span className={hint}>Başlığın hemen altında görünür. Paragraf için bir boş satır bırak.</span>
          </div>
        </div>

        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={ids.content} className={label}>
              Ek içerik (isteğe bağlı)
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
          <p className="mt-1 text-sm text-slate-600">
            Bölgeye özel bilgi, ipuçları ve görseller. Sayfada fiyat etkenlerinden sonra, sık sorulan sorulardan önce görünür.
          </p>

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
              <button type="button" className={toolButton} onClick={() => insert("[", "](/talep-olustur)", "bağlantı metni")}>
                Bağlantı
              </button>
              <button type="button" className={toolButton} onClick={() => insertLine("- ", "Madde")}>
                Liste
              </button>
            </div>
            <textarea
              ref={textarea}
              id={ids.content}
              name="content"
              rows={14}
              value={body}
              onChange={(e) => change(setBody)(e.target.value)}
              className={`${inputClass} font-mono text-[0.95rem] leading-7`}
              placeholder={"## Bölgede taşınırken dikkat edilecekler\n\nMetin…"}
            />
            <div className="mt-3">
              <ImagePicker uploadLabel="İçeriğe görsel ekle" onSelect={(item) => insertLine(`![${item.alt}](${item.src})`, "")} />
            </div>
          </div>

          {tab === "preview" && (
            <div className="mt-3 min-h-40 rounded-lg border border-slate-200 p-4 sm:p-6">
              {previewHtml === null ? (
                <p className="text-sm text-slate-600">Önizleme hazırlanıyor…</p>
              ) : previewHtml ? (
                <div className={`${BLOG_PROSE} !mt-0`} dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-sm text-slate-600">Ek içerik boş.</p>
              )}
            </div>
          )}
        </div>

        <FaqEditor faq={faq} onChange={change(setFaq)} />
        <p className="-mt-3 text-xs text-slate-700">
          Soru eklersen sayfadaki otomatik soruların yerine bunlar görünür. Hiç soru eklemezsen otomatik sorular kalır.
        </p>
      </div>

      <aside className="min-w-0 space-y-5">
        <div className={`${card} space-y-3`}>
          <h2 className="font-semibold text-slate-900">Kaydet</h2>
          <Button type="submit" disabled={pending || resetting} className="w-full">
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          {notice && !error && (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              {notice}
            </p>
          )}
          <FormError message={error} />
          <p className="text-xs text-slate-500">
            <Link href={`/${page.slug}`} target="_blank" className="font-medium text-brand-700 hover:underline">
              Sayfayı sitede gör ↗
            </Link>
          </p>
          {content && (
            <button
              type="button"
              onClick={reset}
              disabled={resetting}
              className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
            >
              Varsayılana dön (tüm değişiklikleri sil)
            </button>
          )}
        </div>

        <div className={`${card} space-y-3`}>
          <h2 className="font-semibold text-slate-900">Kapak görseli</h2>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.thumb.src} alt="" className="aspect-[16/9] w-full rounded-lg bg-slate-100 object-cover" />
          ) : (
            <p className="text-sm text-slate-600">Yatay (16:9) bir fotoğraf seç; teklif düğmesinin altında görünür.</p>
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
                  placeholder="Ör. Bursa'da apartmandan yüklenen eşyalar"
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
          <h2 className="font-semibold text-slate-900">Google görünümü</h2>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.seoTitle} className={label}>
                Google başlığı
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
              placeholder={page.defaults.seoTitle}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={ids.seoDescription} className={label}>
                Google açıklaması
              </label>
              <Counter value={seoDescription} max={BLOG_RULES.seoDescriptionMax} ideal={SEO_DESCRIPTION_IDEAL} />
            </div>
            <textarea
              id={ids.seoDescription}
              name="seoDescription"
              rows={4}
              maxLength={BLOG_RULES.seoDescriptionMax}
              value={seoDescription}
              onChange={(e) => change(setSeoDescription)(e.target.value)}
              className={inputClass}
              placeholder={page.defaults.seoDescription}
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3" aria-label="Google sonuç önizlemesi">
            <p className="truncate text-xs text-slate-600">
              {SITE_NAME} › {page.slug}
            </p>
            <p className="mt-0.5 line-clamp-2 text-base text-[#1a0dab]">{googleTitle}</p>
            <p className="mt-0.5 line-clamp-3 text-sm text-slate-700">{googleDescription}</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
