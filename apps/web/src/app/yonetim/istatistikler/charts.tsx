/**
 * İstatistik ekranının grafikleri: kütüphanesiz, sunucuda çizilen SVG ve div çubuklar.
 * Her grafik tek seri ve tek renk (brand-600); değerler metin renginde yazılır, çubuk yalnızca büyüklüğü gösterir.
 * Üzerine gelince <title> ile değer görünür; ekran okuyucu için aynı veri tablo olarak da var.
 */

const numberFormat = new Intl.NumberFormat("tr-TR");
export const formatNumber = (n: number) => numberFormat.format(n);

const percentFormat = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
export const formatPercent = (rate: number | null) => (rate === null ? "—" : percentFormat.format(rate));

const dayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
/** "2026-10-03" → "3 Eki" (gün anahtarı zaten Türkiye günü) */
export const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));

/** Eksen üst sınırı: 1, 2, 5 × 10ⁿ basamaklarına yuvarlanır */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((m) => m * pow >= max)!;
  return step * pow;
}

/** Günlük sütun grafiği (tek seri). Tarih eksenini ilk, orta ve son gün etiketler. */
export function DailyColumns({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: { day: string; value: number }[];
}) {
  const W = 600;
  const H = 160;
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const slot = W / points.length;
  const gap = points.length > 40 ? 1 : 2;
  const mid = Math.floor((points.length - 1) / 2);
  const labels = [points[0], points[mid], points.at(-1)].filter((p, i, a) => p && a.indexOf(p) === i);

  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-sm text-slate-600 tabular-nums">
          Toplam {formatNumber(total)} {unit}
        </span>
      </figcaption>
      <div className="relative mt-3 pl-7">
        <span className="absolute top-0 left-0 text-xs text-slate-500 tabular-nums" aria-hidden>
          {formatNumber(max)}
        </span>
        <span className="absolute bottom-0 left-0 text-xs text-slate-500" aria-hidden>
          0
        </span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-36 w-full"
          role="img"
          aria-label={`${title}: ${points.length} günde toplam ${formatNumber(total)} ${unit}`}
        >
          <line x1="0" x2={W} y1="0.5" y2="0.5" className="stroke-slate-200" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-slate-200" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => {
            const h = (p.value / max) * H;
            return (
              <g key={p.day} className="group">
                {/* Çubuktan geniş, tam yükseklikte görünmez alan: üzerine gelmesi kolay olsun */}
                <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
                {p.value > 0 && (
                  <rect
                    x={i * slot + gap / 2}
                    y={H - Math.max(h, 2)}
                    width={Math.max(slot - gap, 1)}
                    height={Math.max(h, 2)}
                    className="fill-brand-600 group-hover:fill-brand-800"
                  />
                )}
                <title>{`${formatDay(p.day)}: ${formatNumber(p.value)} ${unit}`}</title>
              </g>
            );
          })}
          <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-slate-400" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 flex justify-between text-xs text-slate-500" aria-hidden>
          {labels.map((p) => (
            <span key={p!.day}>{formatDay(p!.day)}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** Yatay çubuk: tablo hücresi içinde ya da huni satırında oran göstergesi */
export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div className="h-2.5 w-full rounded-full bg-slate-100" title={label} aria-hidden>
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
    </div>
  );
}
