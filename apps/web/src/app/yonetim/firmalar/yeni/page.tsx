import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { createCompany } from "@/lib/actions/admin";
import { cityOptions } from "@/lib/company";
import { ProfileForm } from "@/app/firma-paneli/profile-form";
import { AccountFields } from "../../account-fields";
import { PageHeader } from "../../admin-bits";

export const metadata: Metadata = { title: "Firma ekle" };

export default async function AdminNewCompanyPage() {
  await getAdminContext();
  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/firmalar", label: "Firmalar" }}
        title="Firma ekle"
        description="Firmayı yetkilisinin hesabıyla birlikte açar. Firma onay bekler durumda başlar; onay için zorunlu belgeler yine yüklenmeli (firma paneline geçip yükleyebilirsin)."
      />
      <Card className="max-w-3xl p-6">
        <ProfileForm cities={cityOptions} action={createCompany}>
          <fieldset className="space-y-4 border-b border-zinc-200 pb-5">
            <legend className="mb-3 font-semibold text-zinc-900">Yetkilinin hesabı</legend>
            <AccountFields nameLabel="Yetkilinin adı soyadı" />
          </fieldset>
          <h2 className="font-semibold text-zinc-900">Firma bilgileri</h2>
        </ProfileForm>
      </Card>
    </>
  );
}
