import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Firma paneli",
  robots: { index: false, follow: false },
};

// Firma profili, gelen talepler ve teklif ekranları sonraki adımda buraya gelecek.
export default async function CompanyPanelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/firma-paneli");
  if (user.role !== "COMPANY") redirect(homeFor(user.role));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Firma paneli</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Hoş geldin {user.fullName}. Firma profilini ve bölgendeki talepleri yönetebileceğin panel
        çok yakında burada olacak.
      </p>
    </main>
  );
}
