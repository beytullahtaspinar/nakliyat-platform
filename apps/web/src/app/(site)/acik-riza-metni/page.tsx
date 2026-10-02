import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/legal";

const PATH = "/acik-riza-metni";

export const metadata: Metadata = {
  title: "Açık Rıza Metni",
  description:
    "evdenevenakliyat.app'ten kampanya ve duyuru iletileri almak için verilen isteğe bağlı açık rıza ve ticari elektronik ileti onayı.",
  alternates: { canonical: PATH },
};

const SECTIONS = [
  { id: "kapsam", title: "Neye izin veriyorsunuz?" },
  { id: "veriler", title: "Kullanılacak bilgiler" },
  { id: "istege-bagli", title: "İsteğe bağlıdır" },
  { id: "geri-alma", title: "İzni geri alma" },
];

export default function ExplicitConsentPage() {
  return (
    <LegalPage
      title="Açık Rıza Metni"
      path={PATH}
      sections={SECTIONS}
      intro={
        <p>
          Bu metin, kayıt sırasında isteğe bağlı olarak verebileceğiniz izni açıklar. Platformun
          temel hizmetleri (talep, teklif, iş bildirimleri) açık rızaya dayanmaz; onlar{" "}
          <Link href="/kvkk-aydinlatma-metni" className="font-medium text-brand-700 underline">
            KVKK Aydınlatma Metni
          </Link>
          &apos;nde anlatılan hukuki sebeplerle işlenir.
        </p>
      }
    >
      <h2 id="kapsam">1. Neye izin veriyorsunuz?</h2>
      <p>
        &quot;Kampanya ve duyurulardan haberdar olmak istiyorum&quot; kutusunu işaretlediğinizde, {COMPANY.title}
        &apos;ın; 6698 sayılı Kişisel Verilerin Korunması Kanunu&apos;nun 5/1. maddesi ve 6563 sayılı Elektronik
        Ticaretin Düzenlenmesi Hakkında Kanun kapsamında, size aşağıdaki konularda e-posta, SMS ve uygulama
        bildirimi yoluyla ticari elektronik ileti göndermesine izin vermiş olursunuz:
      </p>
      <ul>
        <li>Platformdaki yeni özellikler, kampanyalar ve indirimler</li>
        <li>Taşınma rehberleri, fiyat bültenleri ve sektör duyuruları</li>
        <li>Firmalar için: yeni bölgelerdeki talep yoğunluğu ve firma hizmetleri hakkında bilgilendirmeler</li>
      </ul>

      <h2 id="veriler">2. Kullanılacak bilgiler</h2>
      <p>
        Bu amaçla yalnızca ad soyadınız, e-posta adresiniz, telefon numaranız, hesap türünüz (müşteri/firma) ve
        hizmet bölgeniz kullanılır. İletiler, KVKK Aydınlatma Metni&apos;nde sayılan e-posta ve SMS hizmet
        sağlayıcıları aracılığıyla gönderilir. Telefon ve e-posta adresiniz, mevzuat gereği İleti Yönetim Sistemi&apos;ne
        (İYS) kaydedilebilir.
      </p>

      <h2 id="istege-bagli">3. İsteğe bağlıdır</h2>
      <p>
        Bu izni vermek zorunda değilsiniz. İzin vermemeniz, platformu kullanmanızı, talep oluşturmanızı, teklif
        almanızı veya vermenizi hiçbir şekilde etkilemez. İşlem bildirimleri (doğrulama kodu, yeni teklif, iş durumu)
        bu izinden bağımsızdır.
      </p>

      <h2 id="geri-alma">4. İzni geri alma</h2>
      <p>
        İzninizi dilediğiniz zaman, ücretsiz olarak; her iletideki &quot;abonelikten çık&quot; bağlantısıyla, İYS
        üzerinden veya <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a> adresine yazarak geri
        alabilirsiniz. Geri alma, o tarihten sonraki gönderimleri durdurur.
      </p>
    </LegalPage>
  );
}
