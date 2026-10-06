import Link from "next/link";

/** Sıralama seçenekleri: adres değeri → API değeri */
export const REVIEW_SORTS = [
  { value: "yeni", api: "newest", label: "En yeni" },
  { value: "eski", api: "oldest", label: "En eski" },
  { value: "dusuk", api: "lowest", label: "En düşük puan" },
  { value: "yuksek", api: "highest", label: "En yüksek puan" },
] as const;

/** Adres parametrelerinden API süzgeci: ?puan=1&sirala=dusuk → { rating: 1, sort: "lowest" } */
export function reviewFilters(params: { puan?: string; sirala?: string }) {
  const rating = Number(params.puan);
  const sort = REVIEW_SORTS.find((s) => s.value === params.sirala) ?? REVIEW_SORTS[0];
  return {
    puan: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    sirala: sort.value === "yeni" ? undefined : sort.value,
    sort: sort.api,
  };
}

const control =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 focus:outline-none";

/**
 * Değerlendirme listesi araç çubuğu (GET formu): arama, puan ve sıralama. Sekme süzgeci gizli alanla
 * korunur; uygulanınca ilk sayfaya dönülür. JavaScript olmadan da çalışır.
 */
export function ReviewToolbar({
  action,
  q,
  rating,
  sort,
  keep = {},
  placeholder,
}: {
  action: string;
  q?: string;
  rating?: number;
  sort?: string;
  keep?: Record<string, string | undefined>;
  placeholder: string;
}) {
  const filtered = Boolean(q || rating || sort);
  // Temizle: arama, puan ve sıralama kalkar, sekme kalır
  const kept = new URLSearchParams(Object.entries(keep).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const clearHref = kept ? `${action}?${kept}` : action;
  return (
    // key: sayfa içi gezinmede (ör. Temizle) seçimler adresteki değerlere dönsün
    <form
      key={`${q ?? ""}|${rating ?? ""}|${sort ?? ""}|${kept}`}
      action={action}
      role="search"
      aria-label="Değerlendirmeleri süz"
      className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] sm:items-end"
    >
      {Object.entries(keep).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="degerlendirme-ara" className="mb-1 block text-xs font-medium text-slate-600">
          Ara
        </label>
        <input
          id="degerlendirme-ara"
          name="ara"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          className={control}
        />
      </div>
      <div>
        <label htmlFor="degerlendirme-puan" className="mb-1 block text-xs font-medium text-slate-600">
          Puan
        </label>
        <select id="degerlendirme-puan" name="puan" defaultValue={rating ? String(rating) : ""} className={control}>
          <option value="">Tüm puanlar</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} yıldız
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="degerlendirme-sirala" className="mb-1 block text-xs font-medium text-slate-600">
          Sırala
        </label>
        <select id="degerlendirme-sirala" name="sirala" defaultValue={sort ?? "yeni"} className={control}>
          {REVIEW_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 sm:flex-none"
        >
          Uygula
        </button>
        {filtered && (
          <Link
            href={clearHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Temizle
          </Link>
        )}
      </div>
    </form>
  );
}
