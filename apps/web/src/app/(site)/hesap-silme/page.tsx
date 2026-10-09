import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { COMPANY } from "@/lib/legal";
import { getCurrentUser, homeFor } from "@/lib/session";
import { DeleteAccountForm } from "./delete-account-form";

const PATH = "/hesap-silme";

export const metadata: Metadata = {
  title: "Hesabını sil",
  description: "evdenevenakliyat.app hesabını ve kişisel verilerini nasıl silebileceğin, nelerin silinip nelerin saklandığı.",
  alternates: { canonical: PATH },
};

/**
 * Hesap silme sayfası. Mobil uygulamalardaki "Hesabımı sil" ile aynı işi yapar;
 * Google Play'in istediği "hesap silme bağlantısı" da bu sayfadır.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ silindi?: string }> }) {
  const { silindi } = await searchParams;
  const user = silindi ? null : await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Hesabını sil</h1>

      {silindi ? (
        <Card className="mt-6 p-6">
          <p role="status" className="font-medium">
            Hesabın silindi.
          </p>
          <p className="mt-2 text-sm text-zinc-600">Bizi tercih ettiğin için teşekkür ederiz. İstediğin zaman yeniden kayıt olabilirsin.</p>
        </Card>
      ) : (
        <>
          <p className="mt-2 text-zinc-600">
            Hesabını buradan ya da firma ve müşteri uygulamalarında <strong>Hesap → Hesabımı sil</strong> adımından silebilirsin.
          </p>

          <Card className="mt-6 p-6">
            <h2 className="text-lg font-semibold">Neler silinir?</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
              <li>Adın, telefon numaran, e-posta adresin ve şifren</li>
              <li>Google ya da Apple hesabı bağlantın ve telefonlarındaki bildirim kayıtları</li>
              <li>Talep fotoğraf ve videoların, firma belgeleri ve tanıtım fotoğrafları</li>
              <li>Mesajlarının ve yorumlarının metni</li>
              <li>Açık taleplerin iptal edilir; firmaysan bekleyen tekliflerin geri çekilir ve firman listelerden kalkar</li>
            </ul>
            <h2 className="mt-6 text-lg font-semibold">Neler saklanır?</h2>
            <p className="mt-2 text-sm text-zinc-700">
              Karşı tarafın kayıtları bozulmasın diye, adın olmadan talep, teklif ve iş geçmişi ile verdiğin puan kalır.
              Fatura ve ödeme gibi kanunen saklamamız gereken kayıtlar yasal süre boyunca saklanır. Silme geri alınamaz.
            </p>
            <p className="mt-3 text-sm text-zinc-700">
              Planlanmış bir taşıma işin varsa hesabın, iş tamamlandıktan ya da iptal edildikten sonra silinebilir.
            </p>
          </Card>

          <Card className="mt-6 p-6">
            {user && user.role !== "ADMIN" ? (
              <>
                <h2 className="mb-4 text-lg font-semibold">{user.fullName} hesabını sil</h2>
                <DeleteAccountForm hasPassword={user.hasPassword} />
                <p className="mt-4 text-sm">
                  <Link href={homeFor(user.role)} className="text-brand-700 underline">
                    Vazgeç, hesabıma dön
                  </Link>
                </p>
              </>
            ) : user ? (
              <p className="text-sm text-zinc-700">Yönetici hesapları bu sayfadan silinemez.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-700">Hesabını silmek için önce giriş yap.</p>
                <Link
                  href={`/giris?next=${PATH}`}
                  className="mt-4 inline-block rounded-lg bg-brand-700 px-5 py-2.5 font-medium text-white hover:bg-brand-800"
                >
                  Giriş yap
                </Link>
                <p className="mt-4 text-sm text-zinc-600">
                  Hesabına giremiyorsan kayıtlı e-posta adresinden{" "}
                  <a href={`mailto:${COMPANY.kvkkEmail}`} className="text-brand-700 underline">
                    {COMPANY.kvkkEmail}
                  </a>{" "}
                  adresine yazabilirsin.
                </p>
              </>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
