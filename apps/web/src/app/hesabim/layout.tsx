import type { Metadata } from "next";
import Link from "next/link";
import { PanelShell } from "@/components/panel/panel-shell";
import { PlusIcon } from "@/components/ui/icons";
import { VerifyNotice } from "@/components/verify-notice";
import { apiFetch, type UnreadMessages } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { getAccessToken, getCurrentUser, isImpersonating } from "@/lib/session";
import { AccountNav } from "./account-nav";
import { CustomerImpersonationBanner } from "./impersonation-banner";

export const metadata: Metadata = {
  title: { default: "Hesabım", template: "%s | Hesabım" },
  robots: { index: false, follow: false },
};

/**
 * Müşteri hesabı: firma paneli ve yönetimle aynı kabuk (sol menü, telefonda üstte şerit, ince altbilgi).
 * Oturum ve rol kontrolünü sayfalar yapar (girişe ya da kendi paneline yönlendirir); burada müşteri değilse
 * kabuk çizilmez. Uyarılar (yönetici görünümü, doğrulama) her sayfanın üstünde.
 */
export default async function AccountLayout({ children }: LayoutProps<"/hesabim">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return children;

  const [impersonating, unread] = await Promise.all([
    isImpersonating(),
    // Sayaç yüklenemezse hesap yine açılsın
    apiFetch<UnreadMessages>("/messages/unread", { token: (await getAccessToken())! }).catch(() => null),
  ]);

  return (
    <PanelShell
      home="/hesabim"
      title={user.fullName}
      subtitle="Hesabım"
      nav={<AccountNav unreadMessages={unread?.total} />}
      account={
        <>
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">{formatPhone(user.phone)}</p>
          <Link
            href="/talep-olustur"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-accent-400"
          >
            <PlusIcon className="h-4 w-4" />
            Yeni talep oluştur
          </Link>
          <p className="mt-3 text-sm">
            <Link href="/" className="font-medium text-slate-600 hover:text-slate-900 hover:underline">
              Siteye git
            </Link>
          </p>
        </>
      }
      footer
    >
      <div className="mx-auto w-full max-w-4xl">
        {impersonating && <CustomerImpersonationBanner userId={user.id} name={user.fullName} />}
        {/* Uyarının kendi üst boşluğu sıfırlanır; yoksa kap yer kaplamaz */}
        <div className="mb-6 empty:hidden [&>*:first-child]:mt-0">
          <VerifyNotice user={user} returnTo="/hesabim" />
        </div>
        {children}
      </div>
    </PanelShell>
  );
}
