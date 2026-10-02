import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import type { CompanyProfile } from "@/lib/api";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { VerifyNotice } from "@/components/verify-notice";
import { PanelNav } from "./panel-nav";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: { default: "Firma paneli", template: "%s | Firma paneli" },
  robots: { index: false, follow: false },
};

export default async function CompanyPanelLayout({ children }: LayoutProps<"/firma-paneli">) {
  const { user, profile } = await getCompanyContext();

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Firma bilgilerini gir</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Hoş geldin {user.fullName}. Taleplere teklif verebilmek için önce firmanı tanıt. Ekibimiz vergi
          numaranı ve K3 yetki belgeni kontrol ettikten sonra firman doğrulanır.
        </p>
        <Card className="mt-8 p-6">
          <ProfileForm cities={cityOptions} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-500">Firma paneli</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
        </div>
      </div>
      <VerifyNotice user={user} returnTo="/firma-paneli" />
      <VerificationBanner profile={profile} />
      <PanelNav />
      <div className="mt-6">{children}</div>
    </main>
  );
}

function VerificationBanner({ profile }: { profile: CompanyProfile }) {
  if (profile.verificationStatus === "VERIFIED") return null;
  const rejected = profile.verificationStatus === "REJECTED";
  return (
    <div
      role="status"
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        rejected
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      {rejected ? (
        <>
          <strong>Firma doğrulaması reddedildi.</strong>{" "}
          {profile.verificationNote ? `Gerekçe: ${profile.verificationNote}. ` : ""}
          Bilgilerini firma profilinden düzeltip kaydettiğinde yeniden incelenir.
        </>
      ) : (
        <>
          <strong>Firman doğrulama bekliyor.</strong> Bölgendeki talepleri şimdiden görebilirsin; doğrulama
          tamamlanınca teklif verebileceksin.
        </>
      )}
    </div>
  );
}
