import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, type ContactVerification } from "@/lib/api";
import { getAccessToken, getCurrentUser, homeFor, safeNext, verificationPath } from "@/lib/session";
import { VerificationSteps } from "./verification-steps";

export const metadata: Metadata = {
  title: "Hesabını doğrula",
  robots: { index: false, follow: false },
};

export default async function VerificationPage({ searchParams }: PageProps<"/dogrulama">) {
  const params = await searchParams;
  const next = safeNext(params.next as string | undefined);
  // E-postadaki "Kodu otomatik gir" bağlantısı: /dogrulama?kod=123456
  const emailCode = typeof params.kod === "string" && /^\d{6}$/.test(params.kod) ? params.kod : undefined;
  const user = await getCurrentUser();
  if (!user) {
    const back = emailCode ? `/dogrulama?kod=${emailCode}${next ? `&next=${encodeURIComponent(next)}` : ""}` : verificationPath(next);
    redirect(`/giris?next=${encodeURIComponent(back)}`);
  }

  const status = await apiFetch<ContactVerification>("/auth/verification", { token: (await getAccessToken())! });
  const target = next ?? homeFor(user.role);

  return (
    <main data-panel className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Hesabını doğrula</h1>
      {status.complete ? (
        <Card className="mt-6 p-6">
          <p className="text-zinc-700">
            Hesabın doğrulandı. Talep oluşturabilir, teklif verebilir ve teklifleri kabul edebilirsin.
          </p>
          <ButtonLink href={target} className="mt-5 w-full">
            Devam et
          </ButtonLink>
        </Card>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            {user.role === "COMPANY"
              ? "Taleplere teklif verebilmek için iletişim bilgilerini doğrula. Müşteriler doğrulanmış firmalarla çalışır."
              : "Talebinin firmalara iletilmesi ve teklif kabul edebilmen için iletişim bilgilerini doğrula. Bir kez yapman yeterli."}
          </p>
          <VerificationSteps status={status} next={target} emailCode={emailCode} />
        </>
      )}
    </main>
  );
}
