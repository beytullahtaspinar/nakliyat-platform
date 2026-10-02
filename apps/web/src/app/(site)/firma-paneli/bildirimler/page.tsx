import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notification-settings";
import { AppAndPush } from "@/components/pwa/app-and-push";
import { Card } from "@/components/ui/card";
import { apiFetch, type NotificationPreferences } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { getAccessToken, isImpersonating } from "@/lib/session";

export const metadata: Metadata = { title: "Bildirim ayarları" };

export default async function CompanyNotificationsPage() {
  const { profile } = await getCompanyContext();
  if (!profile) return null;
  const preferences = await apiFetch<NotificationPreferences>("/notifications/preferences", {
    token: (await getAccessToken())!,
  });
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Uygulama ve anlık bildirimler</h2>
        <p className="mt-1 mb-5 text-sm text-zinc-600">
          Yeni talebi ilk gören firma ilk teklifi verir. Siteyi telefonuna kur ve bildirimleri aç.
        </p>
        <AppAndPush
          publicKey={preferences.push?.publicKey ?? null}
          devices={preferences.push?.devices ?? 0}
          impersonating={await isImpersonating()}
        />
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Bildirim ayarları</h2>
        <p className="mt-1 mb-6 text-sm text-zinc-600">
          Bölgendeki yeni talepleri ve teklif kabullerini kaçırmamak için e-posta adresini ekle.
        </p>
        <NotificationSettings preferences={preferences} settingsPath="/firma-paneli/bildirimler" />
      </Card>
    </div>
  );
}
