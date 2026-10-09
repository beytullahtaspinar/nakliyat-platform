import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel/panel-bits";
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
      <PageHeader title="Bildirimler" description="Yeni talep, teklif kabulü ve mesaj bildirimlerini nereden alacağını seç." />
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
      <p className="text-sm text-zinc-600">
        Platformdan ayrılmak mı istiyorsun?{" "}
        <Link href="/hesap-silme" className="text-brand-700 underline">
          Hesabını sil
        </Link>
      </p>
    </div>
  );
}
