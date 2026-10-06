import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/card";
import { HomeIcon, LogOutIcon } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/logo";
import { apiFetch, type BadgeProgress, type CompanyProfile, type UnreadMessages, type VerificationStatus } from "@/lib/api";
import { BADGE_KEYS, BADGE_ORDER } from "@/lib/badges";
import { cityOptions, getCompanyContext } from "@/lib/company";
import { LEGAL_LINKS } from "@/lib/legal";
import { isImpersonating } from "@/lib/session";
import { CompanyBadges } from "@/components/company-badges";
import { LogoutForm } from "@/components/logout-form";
import { AppPrompt } from "@/components/pwa/app-prompt";
import { VerifyNotice } from "@/components/verify-notice";
import { ImpersonationBanner } from "./impersonation-banner";
import { PanelNav, PanelTitle } from "./panel-nav";
import { ProfileForm } from "./profile-form";
export const metadata: Metadata = {
  title: { default: "Firma paneli", template: "%s | Firma paneli" },
  robots: { index: false, follow: false },
};

/**
 * Firma paneli, yönetim paneli gibi kendi kabuğunda: tanıtım sitesinin menüsü yok. Geniş ekranda sol menü
 * (firma adı, doğrulama durumu, gruplu bağlantılar, çıkış), telefonda üstte firma adı ve yatay menü.
 */
export default async function CompanyPanelLayout({ children }: LayoutProps<"/firma-paneli">) {
  const { user, token, profile } = await getCompanyContext();
  const impersonating = await isImpersonating();
  const banner = impersonating && (
    <ImpersonationBanner companyId={profile?.id} companyName={profile?.displayName ?? user.fullName} />
  );

  if (!profile) {
    return (
      <PanelShell userName={user.fullName}>
        <main data-panel className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
          {banner}
          <h1 className="text-2xl font-bold tracking-tight">Firma bilgilerini gir</h1>
          <p className="mt-2 text-slate-600">
            Hoş geldin {user.fullName}. Taleplere teklif verebilmek için önce firmanı tanıt. Ekibimiz vergi
            numaranı ve belgelerini (K3 yetki belgesi, vergi levhası, ticaret sicil) kontrol ettikten sonra firman
            doğrulanır. Belgeleri bir sonraki adımda yükleyeceksin.
          </p>
          <Card className="mt-8 p-6">
            <ProfileForm cities={cityOptions} />
          </Card>
        </main>
      </PanelShell>
    );
  }

  // Sayaç ve rozetler yüklenemezse panel yine açılsın
  const [unread, badges] = await Promise.all([
    apiFetch<UnreadMessages>("/messages/unread", { token }).catch(() => null),
    apiFetch<BadgeProgress>("/company/profile/badges", { token }).catch(() => null),
  ]);
  const earned = badges ? BADGE_ORDER.filter((code) => badges[BADGE_KEYS[code]].earned) : [];

  return (
    <PanelShell
      userName={user.fullName}
      company={
        <div className="mx-3 mb-3 hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 lg:block">
          <p className="truncate text-sm font-semibold text-slate-900" title={profile.displayName}>
            {profile.displayName}
          </p>
          <StatusBadge status={profile.verificationStatus} className="mt-1.5" />
        </div>
      }
      nav={<PanelNav unreadMessages={unread?.total} />}
    >
      <main data-panel className="w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {banner}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
              <span className="truncate">{profile.displayName}</span>
              <StatusBadge status={profile.verificationStatus} className="lg:hidden" />
            </p>
            <PanelTitle className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900" />
          </div>
          {earned.length > 0 && (
            <Link href="/firma-paneli/degerlendirmeler#rozetler" className="block w-fit" aria-label="Rozetlerin">
              <CompanyBadges badges={earned} />
            </Link>
          )}
        </div>
        <VerifyNotice user={user} returnTo="/firma-paneli" />
        <VerificationBanner profile={profile} />
        {!impersonating && <AppPrompt settingsPath="/firma-paneli/bildirimler" />}
        <div className="mt-6">{children}</div>
      </main>
    </PanelShell>
  );
}

const STATUS: Record<VerificationStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  VERIFIED: { label: "Doğrulanmış firma", tone: "success" },
  PENDING: { label: "Doğrulama bekliyor", tone: "warning" },
  REJECTED: { label: "Doğrulama reddedildi", tone: "danger" },
};

function StatusBadge({ status, className = "" }: { status: VerificationStatus; className?: string }) {
  return (
    <Badge tone={STATUS[status].tone} className={className}>
      {STATUS[status].label}
    </Badge>
  );
}

function PanelShell({
  userName,
  company,
  nav,
  children,
}: {
  userName: string;
  company?: React.ReactNode;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const logoutButton = "flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900";
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-100 lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
          <Link href="/firma-paneli" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-slate-900">evdenevenakliyat.app</span>
              <span className="block text-xs text-slate-500">Firma paneli</span>
            </span>
          </Link>
          <LogoutForm className="lg:hidden">
            <button type="submit" className={logoutButton}>
              <LogOutIcon className="h-5 w-5" />
              Çıkış
            </button>
          </LogoutForm>
        </div>
        {company}
        {nav}
        <div className="mt-auto hidden border-t border-slate-200 px-4 py-4 lg:block">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            <HomeIcon className="h-5 w-5" />
            Siteye git
          </Link>
          <p className="mt-4 truncate text-sm font-medium text-slate-900">{userName}</p>
          <p className="text-xs text-slate-500">Firma yetkilisi</p>
          <LogoutForm className="mt-3">
            <button type="submit" className={logoutButton}>
              <LogOutIcon className="h-5 w-5" />
              Çıkış yap
            </button>
          </LogoutForm>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <footer className="border-t border-slate-200 px-4 py-4 text-xs text-slate-600 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} evdenevenakliyat.app</p>
            <nav aria-label="Yasal metinler">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    {/* py-1.5: dokunma hedefi en az 24 px */}
                    <Link href={link.href} className="inline-block py-1.5 hover:text-brand-700 hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </div>
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
