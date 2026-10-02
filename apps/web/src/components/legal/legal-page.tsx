import Link from "next/link";
import { Breadcrumbs } from "@/components/local/breadcrumbs";
import { LEGAL_LINKS, LEGAL_UPDATED } from "@/lib/legal";

/**
 * Yasal metin sayfalarının ortak düzeni: başlık, güncelleme tarihi, içindekiler ve diğer metinlere bağlantılar.
 * Metin içi başlık/paragraf/liste biçimi burada tanımlanır, sayfalar yalnızca düz HTML yazar.
 */
export function LegalPage({
  title,
  path,
  intro,
  sections,
  children,
}: {
  title: string;
  path: string;
  intro: React.ReactNode;
  /** İçindekiler: bölüm kimliği ve başlığı (sayfadaki h2 id'leriyle aynı) */
  sections: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Breadcrumbs
        items={[
          { name: "Ana sayfa", href: "/" },
          { name: title, href: path },
        ]}
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">Son güncelleme: {LEGAL_UPDATED}</p>
      <div className="mt-6 text-lg text-zinc-700">{intro}</div>

      <nav aria-label="İçindekiler" className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">İçindekiler</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-block py-0.5 hover:text-brand-700 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article
        className={[
          "mt-4 text-base leading-7 text-zinc-800",
          "[&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900",
          "[&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-zinc-900",
          "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6",
          "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6",
          "[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline",
          "[&_table]:mt-4 [&_table]:w-full [&_table]:text-left [&_table]:text-sm",
          "[&_th]:border-b [&_th]:border-zinc-300 [&_th]:py-2 [&_th]:pr-3 [&_th]:font-semibold [&_th]:align-bottom",
          "[&_td]:border-b [&_td]:border-zinc-200 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top",
        ].join(" ")}
      >
        {children}
      </article>

      <nav aria-label="Diğer yasal metinler" className="mt-12 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Diğer yasal metinler</h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LEGAL_LINKS.filter((l) => l.href !== path).map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-block py-1 text-brand-700 hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

/** Tablo dar ekranda sayfayı taşırmasın diye yatay kaydırılan kap */
export function TableScroll({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    // Klavyeyle kaydırılabilsin diye odaklanabilir bölge (axe: scrollable-region-focusable)
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
