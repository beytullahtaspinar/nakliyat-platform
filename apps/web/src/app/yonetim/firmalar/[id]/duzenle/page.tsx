import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { updateCompany } from "@/lib/actions/admin";
import { ApiError, apiFetch, type AdminCompanyDetail } from "@/lib/api";
import { cityOptions } from "@/lib/company";
import { ProfileForm } from "@/app/firma-paneli/profile-form";

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
      <p className="text-sm">
        <Link href={`/yonetim/firmalar/${company.id}`} className="font-medium text-brand-700 hover:underline">
          ← {company.displayName}
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Firma bilgilerini düzenle</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Yönetimden yapılan değişiklikler firmanın doğrulama durumunu değiştirmez ve karar geçmişine yazılır.
      </p>
      <Card className="mt-6 p-6">
        <ProfileForm cities={cityOptions} profile={company} action={updateCompany.bind(null, company.id)} />
      </Card>
    </>
  );
}
