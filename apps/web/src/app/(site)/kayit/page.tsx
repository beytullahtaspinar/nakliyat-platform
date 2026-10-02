import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, safeNext } from "@/lib/session";
import { SignedInNotice } from "@/components/signed-in-notice";
import { RegisterForm } from "./register-form";
import { SocialLogin } from "@/components/social-login";
import { getOAuthProviders } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Kayıt ol",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({ searchParams }: PageProps<"/kayit">) {
  const params = await searchParams;
  const next = safeNext(params.next as string | undefined);
  const role = params.rol === "firma" ? "COMPANY" : "CUSTOMER";
  const user = await getCurrentUser();
  if (user) return <SignedInNotice user={user} returnTo={role === "COMPANY" ? "/kayit?rol=firma" : "/kayit"} />;

  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${
      active ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
    }`;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Kayıt ol</h1>
      <div className="mt-6 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist">
        <Link href="/kayit" className={tab(role === "CUSTOMER")} role="tab" aria-selected={role === "CUSTOMER"}>
          Taşınacağım
        </Link>
        <Link href="/kayit?rol=firma" className={tab(role === "COMPANY")} role="tab" aria-selected={role === "COMPANY"}>
          Nakliyat firmasıyım
        </Link>
      </div>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {role === "COMPANY"
          ? "Firma hesabını aç, ardından K3 yetki belgeni ve firma bilgilerini gir. Doğrulamadan sonra bölgendeki taleplere teklif verebilirsin."
          : "Ücretsiz hesap aç, taşınma talebini oluştur, doğrulanmış firmalardan teklifleri karşılaştır."}
      </p>
      <div className="mt-6 space-y-4">
        <SocialLogin providers={await getOAuthProviders()} next={next} role={role} />
        <RegisterForm key={role} role={role} next={next} />
      </div>
    </main>
  );
}
