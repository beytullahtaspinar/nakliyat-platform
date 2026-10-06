import type { Metadata } from "next";
import Link from "next/link";
import { PanelSection } from "@/components/panel/panel-bits";
import { PanelShell } from "@/components/panel/panel-shell";
import { ExternalIcon } from "@/components/ui/icons";
import { apiFetch, type CompanyOverview, type CompanyProfile, type UnreadMessages } from "@/lib/api";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { companyPath } from "@/lib/reviews";
import { isImpersonating } from "@/lib/session";
import { AppPrompt } from "@/components/pwa/app-prompt";
import { VerifyNotice } from "@/components/verify-notice";
import { ImpersonationBanner } from "./impersonation-banner";
import { PanelNav } from "./panel-nav";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: { default: "Firma paneli", template: "%s | Firma paneli" },
  robots: { index: false, follow: false },
};

/**
 * Firma paneli: yönetim paneliyle aynı CRM kabuğu (sol menü, tam genişlik içerik, ince altbilgi).
 * Uyarılar (doğrulama, yönetici görünümü, uygulama hatırlatması) her sayfanın üstünde.
 */
export default async function CompanyPanelLayout({ children }: LayoutProps<"/firma-paneli">) {
  const { user, token, profile } = await getCompanyContext();
  const impersonating = await isImpersonating();
  const banner = impersonating && (
    <ImpersonationBanner companyId={profile?.id} companyName={profile?.displayName ?? user.fullName} />
  );

  if (!profile) {
    return (
      <PanelShell home="/firma-paneli" title="Firma paneli" subtitle={user.fullName} footer>
        <div className="mx-auto max-w-2xl">
          {banner}
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Firma bilgilerini gir</h1>
          <p className="mt-2 text-sm text-slate-600">
            Hoş geldin {user.fullName}. Taleplere teklif verebilmek için önce firmanı tanıt. Ekibimiz vergi
            numaranı ve belgelerini (K3 yetki belgesi, vergi levhası, ticaret sicil) kontrol ettikten sonra firman
            doğrulanır. Belgeleri bir sonraki adımda yükleyeceksin.
          </p>
          <PanelSection id="firma-bilgileri" title="Firma bilgileri" className="mt-6">
            <ProfileForm cities={cityOptions} />
          </PanelSection>
        </div>
      </PanelShell>
    );
  }

  // Sayaçlar yüklenemezse panel yine açılsın
  const [unread, overview] = await Promise.all([
    apiFetch<UnreadMessages>("/messages/unread", { token }).catch(() => null),
    apiFetch<CompanyOverview>("/company/overview", { token }).catch(() => null),
  ]);
  const verified = profile.verificationStatus === "VERIFIED";

  return (
    <PanelShell
      home="/firma-paneli"
      title={profile.displayName}
      subtitle="Firma paneli"
      nav={<PanelNav newRequests={overview?.requests.notQuoted} unreadMessages={unread?.total} />}
      account={
        <>
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">Firma yetkilisi</p>
          <ul className="mt-3 space-y-1 text-sm">
            {verified && (
              <li>
                <Link href={companyPath(profile)} className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
                  Herkese açık sayfan
                  <ExternalIcon className="h-4 w-4" />
                </Link>
              </li>
            )}
            <li>
              <Link href="/" className="font-medium text-slate-600 hover:text-slate-900 hover:underline">
                Siteye git
              </Link>
            </li>
          </ul>
        </>
      }
      footer
    >
      {banner}
      {/* Uyarıların kendi üst boşluğu ilkinde sıfırlanır; hiçbiri yoksa kap yer kaplamaz */}
      <div className="mb-6 empty:hidden [&>*:first-child]:mt-0">
        <VerifyNotice user={user} returnTo="/firma-paneli" />
        <VerificationBanner profile={profile} />
        {!impersonating && <AppPrompt settingsPath="/firma-paneli/bildirimler" />}
      </div>
      {children}
    </PanelShell>
  );
}

function VerificationBanner({ profile }: { profile: CompanyProfile }) {
  if (profile.verificationStatus === "VERIFIED") return null;
  const rejected = profile.verificationStatus === "REJECTED";
  return (
    <div
      role="status"
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        rejected ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
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
