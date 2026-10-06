import type { Metadata } from "next";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Firma profili" };

export default async function CompanyProfilePage() {
  const { profile } = await getCompanyContext();
  if (!profile) return null;
  return (
    <>
      <PageHeader
        title="Firma profili"
        description="Görünen ad, vergi numarası, K3 belge numarası ve hizmet illerin. Vergi ya da K3 numarası değişirse firman yeniden incelenir; ad değişikliği yönetim onayından sonra yayına girer."
      />
      <PanelSection id="firma-bilgileri" title="Firma bilgileri">
        {/* Onay kararı ya da ad değişikliği sonrası form yeni değerlerle baştan kurulur */}
        <ProfileForm
          key={[profile.verificationStatus, profile.displayName, profile.nameChange?.pending?.newName].join("|")}
          cities={cityOptions}
          profile={profile}
        />
      </PanelSection>
    </>
  );
}
