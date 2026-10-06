import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor, safeNext } from "@/lib/session";
import { SignedInNotice } from "@/components/signed-in-notice";
import { SocialLogin } from "@/components/social-login";
import { FormError } from "@/components/forms/fields";
import { OAUTH_ERRORS, getOAuthProviders } from "@/lib/oauth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş yap",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const params = await searchParams;
  const next = safeNext(params.next as string | undefined);
  // Google / Apple girişi başarısız dönerse mesaj burada gösterilir
  const error = typeof params.hata === "string" ? OAUTH_ERRORS[params.hata as keyof typeof OAUTH_ERRORS] : undefined;
  const user = await getCurrentUser();
  if (user) {
    // Yalnızca kişinin kendi alanına dönüş otomatik; başka rolün sayfası istenmişse hesap değişikliği sorulur
    const home = homeFor(user.role);
    if (next && (next === home || next.startsWith(`${home}/`))) redirect(next);
    return <SignedInNotice user={user} returnTo={next ? `/giris?next=${encodeURIComponent(next)}` : "/giris"} />;
  }

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Giriş yap</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Taleplerini ve gelen teklifleri görmek için giriş yap.
      </p>
      <div className="mt-8 space-y-4">
        {params.sifre === "yenilendi" && (
          <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
            Şifren değişti. Yeni şifrenle giriş yap.
          </p>
        )}
        <FormError message={error} />
        <SocialLogin providers={await getOAuthProviders()} next={next} />
        <LoginForm next={next} />
      </div>
    </main>
  );
}
