import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PROVIDER_LABELS, SIGNUP_COOKIE } from "@/lib/oauth";
import { getCurrentUser, homeFor, safeNext } from "@/lib/session";
import { CompleteForm } from "./complete-form";

export const metadata: Metadata = {
  title: "Kaydı tamamla",
  robots: { index: false, follow: false },
};

type Pending = { provider: "GOOGLE" | "APPLE"; fullName: string | null; email: string | null };

/** Google / Apple ile gelen ve hesabı olmayan kişiden telefon ve rol istenir */
export default async function CompleteSignupPage({ searchParams }: PageProps<"/kayit/tamamla">) {
  const params = await searchParams;
  const next = safeNext(params.next as string | undefined);
  const role = params.rol === "firma" ? "COMPANY" : "CUSTOMER";
  const user = await getCurrentUser();
  if (user) redirect(next ?? homeFor(user.role));

  const token = (await cookies()).get(SIGNUP_COOKIE)?.value;
  const pending = token
    ? await apiFetch<Pending>("/auth/oauth/pending", { method: "POST", body: { signupToken: token } }).catch(() => null)
    : null;

  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`;
  const withRole = (r: string) => {
    const q = new URLSearchParams();
    if (next) q.set("next", next);
    if (r === "firma") q.set("rol", "firma");
    return `/kayit/tamamla${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Kaydı tamamla</h1>
      {!pending ? (
        <p className="mt-4 text-sm text-zinc-700">
          Kayıt süresi doldu.{" "}
          <Link href="/kayit" className="font-medium text-brand-700 hover:underline">
            Kayıt sayfasına dön
          </Link>{" "}
          ve tekrar dene.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            {PROVIDER_LABELS[pending.provider.toLowerCase()]} hesabınla devam ediyorsun
            {pending.email ? (
              <>
                {" "}
                (<strong>{pending.email}</strong>)
              </>
            ) : null}
            . Son olarak telefonunu ekle.
          </p>
          <div className="mt-6 flex gap-1 rounded-lg bg-zinc-100 p-1" role="tablist">
            <Link href={withRole("musteri")} className={tab(role === "CUSTOMER")} role="tab" aria-selected={role === "CUSTOMER"}>
              Taşınacağım
            </Link>
            <Link href={withRole("firma")} className={tab(role === "COMPANY")} role="tab" aria-selected={role === "COMPANY"}>
              Nakliyat firmasıyım
            </Link>
          </div>
          <div className="mt-6">
            <CompleteForm key={role} role={role} next={next} fullName={pending.fullName ?? ""} />
          </div>
        </>
      )}
    </main>
  );
}
