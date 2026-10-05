import Link from "next/link";
import { LogoutForm } from "@/components/logout-form";
import { LogOutIcon } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/logo";
import { LEGAL_LINKS } from "@/lib/legal";

/**
 * Yönetim ve firma panelinin ortak kabuğu: tanıtım sitesinin menüsü yok. Geniş ekranda sol menü,
 * telefonda üstte logo + çıkış ve yatay menü; içerik tam genişlikte.
 */
export function PanelShell({
  home,
  title,
  subtitle,
  nav,
  account,
  footer = false,
  children,
}: {
  home: string;
  title: string;
  subtitle: string;
  nav?: React.ReactNode;
  /** Geniş ekranda menünün altında: kullanıcı adı ve kısayollar */
  account?: React.ReactNode;
  /** İnce altbilgi (yasal metinler) */
  footer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-100 lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-8 w-8 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-slate-900">{title}</span>
              <span className="block truncate text-xs text-slate-500">{subtitle}</span>
            </span>
          </Link>
          {/* LogoutForm: çıkışta bu cihazın anlık bildirim kaydı da silinir */}
          <LogoutForm className="shrink-0 lg:hidden">
            <button type="submit" className="flex items-center gap-1.5 py-1 text-sm font-medium text-slate-600 hover:text-slate-900">
              <LogOutIcon className="h-5 w-5" />
              Çıkış
            </button>
          </LogoutForm>
        </div>
        {nav && <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4">{nav}</div>}
        <div className="hidden border-t border-slate-200 px-4 py-4 lg:block">
          {account}
          <LogoutForm className="mt-3">
            <button type="submit" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              <LogOutIcon className="h-5 w-5" />
              Çıkış yap
            </button>
          </LogoutForm>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        {footer && <PanelFooter />}
      </div>
    </div>
  );
}

function PanelFooter() {
  return (
    <footer className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} evdenevenakliyat.app</p>
        <nav aria-label="Yasal metinler">
          <ul className="flex flex-wrap gap-x-4">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                {/* py-1.5: dokunma hedefi en az 24 px (PageSpeed/WCAG 2.5.8) */}
                <Link href={link.href} className="inline-block py-1.5 hover:text-brand-700 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
