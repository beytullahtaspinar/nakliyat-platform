import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Firma profili" };

export default async function CompanyProfilePage() {
  const { profile } = await getCompanyContext();
  if (!profile) return null;
  return (
    <Card className="p-6">
      <ProfileForm key={profile.verificationStatus} cities={cityOptions} profile={profile} />
    </Card>
  );
}
