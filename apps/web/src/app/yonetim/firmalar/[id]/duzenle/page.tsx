import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { updateCompany } from "@/lib/actions/admin";
import { ApiError, apiFetch, type AdminCompanyDetail } from "@/lib/api";
import { cityOptions } from "@/lib/company";
import { PageHeader } from "../../../admin-bits";
import { ProfileForm } from "@/app/(site)/firma-paneli/profile-form";

export const metadata: Metadata = { title: "Firma bilgilerini düzenle" };

export default async function AdminCompanyEditPage({ params }: PageProps<"/yonetim/firmalar/[id]/duzenle">) {
  const { token } = await getAdminContext();
  const { id } = await params;
  const company = await apiFetch<AdminCompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`, { token }).catch(
    (err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    },
  );

  return (
    <>
      <PageHeader
        back={{ href: `/yonetim/firmalar/${company.id}`, label: company.displayName }}
        title="Firma bilgilerini düzenle"
        description="Yönetimden yapılan değişiklikler firmanın doğrulama durumunu değiştirmez ve karar geçmişine yazılır."
      />
      <Card className="max-w-3xl p-6">
        <ProfileForm cities={cityOptions} profile={company} action={updateCompany.bind(null, company.id)} />
      </Card>
    </>
  );
}
