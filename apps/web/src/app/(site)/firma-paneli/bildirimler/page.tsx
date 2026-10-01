import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notification-settings";
import { Card } from "@/components/ui/card";
import { apiFetch, type NotificationPreferences } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { getAccessToken } from "@/lib/session";

export const metadata: Metadata = { title: "Bildirim ayarları" };

export default async function CompanyNotificationsPage() {
  const { profile } = await getCompanyContext();
  if (!profile) return null;
  const preferences = await apiFetch<NotificationPreferences>("/notifications/preferences", {
    token: (await getAccessToken())!,
  });
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Bildirim ayarları</h2>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        Bölgendeki yeni talepleri ve teklif kabullerini kaçırmamak için e-posta adresini ekle.
      </p>
      <NotificationSettings preferences={preferences} settingsPath="/firma-paneli/bildirimler" />
    </Card>
  );
}
