import { Breadcrumbs } from "@/components/local/breadcrumbs";

/** Tanıtım sayfalarının üst bölümü: sayfa yolu, başlık ve giriş paragrafı */
export function PageHero({
  path,
  crumb,
  eyebrow,
  title,
  lead,
  children,
}: {
  path: string;
  crumb: string;
  eyebrow: string;
  title: string;
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white dark:from-brand-950/60 dark:to-zinc-950">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 lg:pb-20">
        <Breadcrumbs
          items={[
            { name: "Ana sayfa", href: "/" },
            { name: crumb, href: path },
          ]}
        />
        <p className="mt-10 text-sm font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
          {eyebrow}
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[1.1] text-zinc-900 sm:text-5xl dark:text-white">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">{lead}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
