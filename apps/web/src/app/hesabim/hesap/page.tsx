import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, PanelSection } from "@/components/panel/panel-bits";
import { Badge } from "@/components/ui/card";
import { formatPhone } from "@/lib/format";
import { COMPANY } from "@/lib/legal";
import { getCurrentUser, homeFor, isImpersonating, verificationPath } from "@/lib/session";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Hesap bilgileri" };

export default async function AccountDetailsPage({ searchParams }: PageProps<"/hesabim/hesap">) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/hesabim/hesap");
  if (user.role !== "CUSTOMER") redirect(homeFor(user.role));
  // Yönetici görünümünde ad ve şifre değiştirilemez (API de reddeder)
  const impersonating = await isImpersonating();
  const { sifre } = await searchParams;

  // Hesap e-postayla doğrulanmış olabilir; doğrulanmamış telefon ayrıca uyarılmaz
  const verified = (ok: boolean) =>
    ok ? <Badge tone="success">Doğrulandı</Badge> : <Badge tone="warning">Doğrulanmadı</Badge>;

  return (
    <div className="space-y-6">
      <PageHeader title="Hesap bilgileri" description="Adın, iletişim bilgilerin ve giriş şifren" />

      <PanelSection id="kisisel" title="Kişisel bilgiler">
        {impersonating ? (
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Ad soyad:</span> {user.fullName}
          </p>
        ) : (
          <NameForm fullName={user.fullName} />
        )}
        <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-slate-500">Cep telefonu</dt>
            <dd className="flex items-center gap-2 font-medium text-slate-900">
              {formatPhone(user.phone)} {user.phoneVerified && verified(true)}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-slate-500">E-posta</dt>
            <dd className="flex min-w-0 items-center gap-2 font-medium text-slate-900">
              <span className="truncate">{user.email ?? "Eklenmedi"}</span> {user.email && verified(user.emailVerified)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          E-posta adresini{" "}
          <Link href="/hesabim/bildirimler" className="font-medium text-brand-700 underline">
            Bildirimler
          </Link>{" "}
          sayfasından değiştirebilirsin; yeni adresi doğrulaman gerekir. Telefon numaranı değiştirmek için{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="font-medium text-brand-700 underline">
            {COMPANY.supportEmail}
          </a>{" "}
          adresine yaz.
          {!user.verified && (
            <>
              {" "}
              <Link href={verificationPath("/hesabim/hesap")} className="font-semibold text-amber-900 underline">
                Hesabını şimdi doğrula
              </Link>
            </>
          )}
        </p>
      </PanelSection>

      <PanelSection
        id="sifre"
        title="Giriş şifresi"
        description={
          user.hasPassword
            ? "Şifreni değiştirdiğinde diğer cihazlardaki oturumların kapanır."
            : "Hesabını Google ya da Apple ile açtın; şifren yok."
        }
      >
        {impersonating ? (
          <p className="text-sm text-slate-600">Yönetici görünümündeyken şifre değiştirilemez.</p>
        ) : user.hasPassword ? (
          <PasswordForm changed={sifre === "degisti"} />
        ) : (
          <p className="text-sm text-slate-700">
            Telefon numaran ya da e-postanla da giriş yapmak istersen{" "}
            <Link href="/sifre-sifirla" className="font-medium text-brand-700 underline">
              e-postana kod gönderip şifre belirle
            </Link>
            .
          </p>
        )}
      </PanelSection>

      <PanelSection
        id="hesap-silme"
        title="Hesabı sil"
        description="Hesabın ve kişisel verilerin kalıcı olarak silinir. Planlanmış bir taşıman varsa iş bitince silebilirsin."
        actions={
          <Link
            href="/hesap-silme"
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
          >
            Hesabımı sil
          </Link>
        }
      />
    </div>
  );
}
