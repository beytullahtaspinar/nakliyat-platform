import Link from "next/link";

export function LinkGrid({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-blue-700 hover:underline dark:text-blue-400">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
