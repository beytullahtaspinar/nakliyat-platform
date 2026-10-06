import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/panel-shell";
import { getAdminContext } from "@/lib/admin";
import { apiFetch, type AdminSummary } from "@/lib/api";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s | Yönetim" },
  robots: { index: false, follow: false },
};

/** Yönetim paneli: tanıtım sitesinin menüsü ve altbilgisi yok (ortak panel kabuğu). */
export default async function AdminLayout({ children }: LayoutProps<"/yonetim">) {
  const { user, token } = await getAdminContext();
  const summary = await apiFetch<AdminSummary>("/admin/summary", { token });

  return (
    <PanelShell
      home="/yonetim"
      title="Nakliyat CRM"
      subtitle="Yönetim paneli"
      nav={
        <AdminNav
          pendingCompanies={summary.companies.pending}
          pendingDocuments={summary.documents.pending}
          pendingNameChanges={summary.nameChanges.pending}
        />
      }
      account={
        <>
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">Yönetici</p>
        </>
      }
    >
      {children}
    </PanelShell>
  );
}
