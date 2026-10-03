import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { apiFetch, type BadgeProgress, type CompanyProfile, type UnreadMessages } from "@/lib/api";
import { BADGE_KEYS, BADGE_ORDER } from "@/lib/badges";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { isImpersonating } from "@/lib/session";
import { CompanyBadges } from "@/components/company-badges";
import { AppPrompt } from "@/components/pwa/app-prompt";
import { VerifyNotice } from "@/components/verify-notice";
import { ImpersonationBanner } from "./impersonation-banner";
import { PanelNav } from "./panel-nav";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: { default: "Firma paneli", template: "%s | Firma paneli" },
  robots: { index: false, follow: false },
};

export default async function CompanyPanelLayout({ children }: LayoutProps<"/firma-paneli">) {
  const { user, token, profile } = await getCompanyContext();
  const impersonating = await isImpersonating();
  const banner = impersonating && (
    <ImpersonationBanner companyId={profile?.id} companyName={profile?.displayName ?? user.fullName} />
  );

  if (!profile) {
    return (
      <main data-panel className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        {banner}
        <h1 className="text-2xl font-bold tracking-tight">Firma bilgilerini gir</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Hoş geldin {user.fullName}. Taleplere teklif verebilmek için önce firmanı tanıt. Ekibimiz vergi
          numaranı ve belgelerini (K3 yetki belgesi, vergi levhası, ticaret sicil) kontrol ettikten sonra firman
          doğrulanır. Belgeleri bir sonraki adımda yükleyeceksin.
        </p>
        <Card className="mt-8 p-6">
          <ProfileForm cities={cityOptions} />
        </Card>
      </main>
    );
  }

  // Sayaç ve rozetler yüklenemezse panel yine açılsın
  const [unread, badges] = await Promise.all([
    apiFetch<UnreadMessages>("/messages/unread", { token }).catch(() => null),
    apiFetch<BadgeProgress>("/company/profile/badges", { token }).catch(() => null),
  ]);
  const earned = badges ? BADGE_ORDER.filter((code) => badges[BADGE_KEYS[code]].earned) : [];

  return (
    <main data-panel className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      {banner}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-500">Firma paneli</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          {earned.length > 0 && (
            <Link href="/firma-paneli/degerlendirmeler#rozetler" className="mt-2 block w-fit" aria-label="Rozetlerin">
              <CompanyBadges badges={earned} />
            </Link>
          )}
        </div>
      </div>
      <VerifyNotice user={user} returnTo="/firma-paneli" />
      <VerificationBanner profile={profile} />
      <PanelNav unreadMessages={unread?.total} />
      {!impersonating && <AppPrompt settingsPath="/firma-paneli/bildirimler" />}
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
          Bilgilerini firma profilinden düzeltip kaydettiğinde ya da{" "}
          <Link href="/firma-paneli/belgeler" className="font-semibold underline">
            yeni belge yüklediğinde
          </Link>{" "}
          yeniden incelenir.
        </>
      ) : (
        <>
          <strong>Firman doğrulama bekliyor.</strong> K3 yetki belgesi, vergi levhası ve ticaret sicil belgeni{" "}
          <Link href="/firma-paneli/belgeler" className="font-semibold underline">
            Belgeler
          </Link>{" "}
          sayfasından yükle. Bölgendeki talepleri şimdiden görebilirsin; doğrulama tamamlanınca teklif verebileceksin.
        </>
      )}
    </div>
  );
}
