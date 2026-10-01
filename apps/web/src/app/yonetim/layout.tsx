import type { Metadata } from "next";
import Link from "next/link";
import { LogOutIcon } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/logo";
import { getAdminContext } from "@/lib/admin";
import { logout } from "@/lib/actions/auth";
import { apiFetch, type AdminSummary } from "@/lib/api";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s | Yönetim" },
  robots: { index: false, follow: false },
};

/**
 * Yönetim paneli: tanıtım sitesinin menüsü ve altbilgisi yok. Geniş ekranda sol menü,
 * telefonda üstte yatay menü; içerik tam genişlikte tablolar.
 */
export default async function AdminLayout({ children }: LayoutProps<"/yonetim">) {
  const { user, token } = await getAdminContext();
  const summary = await apiFetch<AdminSummary>("/admin/summary", { token });

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-100 lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
          <Link href="/yonetim" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-slate-900">Nakliyat CRM</span>
              <span className="block text-xs text-slate-500">Yönetim paneli</span>
            </span>
          </Link>
          <form action={logout} className="lg:hidden">
            <button type="submit" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              <LogOutIcon className="h-5 w-5" />
              Çıkış
            </button>
          </form>
        </div>
        <AdminNav pendingCompanies={summary.companies.pending} />
        <div className="mt-auto hidden border-t border-slate-200 px-4 py-4 lg:block">
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">Yönetici</p>
          <form action={logout} className="mt-3">
            <button type="submit" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              <LogOutIcon className="h-5 w-5" />
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
