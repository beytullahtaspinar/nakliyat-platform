import Link from "next/link";

export function LinkGrid({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-brand-700 dark:hover:bg-brand-950 dark:hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
