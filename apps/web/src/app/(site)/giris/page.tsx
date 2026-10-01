import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor, safeNext } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş yap",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const next = safeNext((await searchParams).next as string | undefined);
  const user = await getCurrentUser();
  if (user) redirect(next ?? homeFor(user.role));

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Giriş yap</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Taleplerini ve gelen teklifleri görmek için giriş yap.
      </p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
