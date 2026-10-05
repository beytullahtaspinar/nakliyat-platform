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
        description="Unvan, vergi numarası, K3 belge numarası ve hizmet illerin. Unvan, vergi ya da K3 numarası değişirse firman yeniden incelenir."
      />
      <PanelSection id="firma-bilgileri" title="Firma bilgileri">
        <ProfileForm key={profile.verificationStatus} cities={cityOptions} profile={profile} />
      </PanelSection>
    </>
  );
}
