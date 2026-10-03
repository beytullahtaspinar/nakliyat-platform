import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationSettings } from "@/components/notification-settings";
import { AppAndPush } from "@/components/pwa/app-and-push";
import { Card } from "@/components/ui/card";
import { apiFetch, type NotificationPreferences } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Bildirim ayarları",
  robots: { index: false, follow: false },
};

export default async function AccountNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/hesabim/bildirimler");
  if (user.role !== "CUSTOMER") redirect(user.role === "COMPANY" ? "/firma-paneli/bildirimler" : homeFor(user.role));

  const preferences = await apiFetch<NotificationPreferences>("/notifications/preferences", {
    token: (await getAccessToken())!,
  });
  return (
    <main data-panel className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/hesabim" className="text-sm text-zinc-500 hover:underline">
        ← Hesabım
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Bildirim ayarları</h1>
      <p className="mt-1 text-sm text-zinc-600">Yeni teklif geldiğinde ve taşıman kesinleştiğinde haber verelim.</p>
      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Uygulama ve anlık bildirimler</h2>
        <p className="mt-1 mb-5 text-sm text-zinc-600">Yeni teklif geldiğinde telefonuna anında haber verelim.</p>
        <AppAndPush
          publicKey={preferences.push?.publicKey ?? null}
          devices={preferences.push?.devices ?? 0}
          impersonating={false}
        />
      </Card>
      <Card className="mt-6 p-6">
        <NotificationSettings preferences={preferences} settingsPath="/hesabim/bildirimler" />
      </Card>
    </main>
  );
}
