import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationSettings } from "@/components/notification-settings";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { AppAndPush } from "@/components/pwa/app-and-push";
import { apiFetch, type NotificationPreferences } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor, isImpersonating } from "@/lib/session";

export const metadata: Metadata = { title: "Bildirim ayarları" };

export default async function AccountNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/hesabim/bildirimler");
  if (user.role !== "CUSTOMER") redirect(user.role === "COMPANY" ? "/firma-paneli/bildirimler" : homeFor(user.role));

  const preferences = await apiFetch<NotificationPreferences>("/notifications/preferences", {
    token: (await getAccessToken())!,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Bildirim ayarları" description="Yeni teklif geldiğinde, firma yazdığında ve taşıman kesinleştiğinde haber verelim." />
      <PanelSection
        id="uygulama"
        title="Uygulama ve anlık bildirimler"
        description="Siteyi telefonuna kur; yeni teklif geldiğinde anında haber verelim."
      >
        <AppAndPush
          publicKey={preferences.push?.publicKey ?? null}
          devices={preferences.push?.devices ?? 0}
          impersonating={await isImpersonating()}
          viewer="CUSTOMER"
        />
      </PanelSection>
      <PanelSection id="eposta-bildirim" title="E-posta bildirimleri" description="Bildirimlerin gideceği adres ve hangi durumlarda haber vereceğimiz.">
        <NotificationSettings preferences={preferences} settingsPath="/hesabim/bildirimler" />
      </PanelSection>
    </div>
  );
}
