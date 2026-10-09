import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import type { AdminCreditSettings } from "@/lib/credits";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "../../admin-bits";
import { CreditSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: { absolute: "Kredi ayarları | Yönetim" } };

export default async function AdminCreditSettingsPage() {
  const { token } = await getAdminContext();
  const view = await apiFetch<AdminCreditSettings>("/admin/credits/settings", { token });
  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/krediler", label: "Krediler" }}
        title="Kredi ayarları"
        description={
          <>
            Teklif başına kredi ve iade kuralları. Değişiklikler hemen geçerli olur ve karar geçmişine yazılır; verilmiş tekliflerin kredisi
            değişmez.{view.updatedAt && ` Son değişiklik: ${formatDateTime(view.updatedAt)}.`}
          </>
        }
      />
      <CreditSettingsForm settings={view.settings} defaults={view.defaults} iyzico={view.card} />
    </>
  );
}
