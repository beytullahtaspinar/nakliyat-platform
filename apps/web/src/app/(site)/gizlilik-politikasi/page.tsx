import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/legal";

const PATH = "/gizlilik-politikasi";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "evdenevenakliyat.app'te bilgilerinizin kimlerle, hangi aşamada paylaşıldığı ve nasıl korunduğu: kısa ve anlaşılır özet.",
  alternates: { canonical: PATH },
};

const SECTIONS = [
  { id: "ozet", title: "Kısaca" },
  { id: "kim-gorur", title: "Bilgilerinizi kim görür?" },
  { id: "koruma", title: "Bilgilerinizi nasıl koruyoruz?" },
  { id: "dosyalar", title: "Fotoğraf, video ve belgeler" },
  { id: "iletiler", title: "E-posta ve bildirimler" },
  { id: "silme", title: "Hesabınızı ve verilerinizi silme" },
  { id: "cocuklar", title: "18 yaş altı" },
  { id: "iletisim", title: "İletişim" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      path={PATH}
      sections={SECTIONS}
      intro={
        <p>
          Bu sayfa, bilgilerinizi nasıl kullandığımızı ve koruduğumuzu sade bir dille özetler. Hukuki ayrıntılar ve
          haklarınız <Link href="/kvkk-aydinlatma-metni" className="font-medium text-brand-700 underline">
            KVKK Aydınlatma Metni
          </Link>
          &apos;ndedir.
        </p>
      }
    >
      <h2 id="ozet">1. Kısaca</h2>
      <ul>
        <li>Bilgilerinizi yalnızca taşınmanız için teklif alabilmeniz ve hizmetin güvenliği için kullanırız.</li>
        <li>Bilgilerinizi satmayız, reklam için kullanmayız, reklam veya takip çerezi kullanmayız.</li>
        <li>
          Telefonunuz, açık adresiniz ve harita konumunuz, siz bir teklifi kabul edene kadar hiçbir firmaya
          gösterilmez.
        </li>
        <li>İzin vermediğiniz sürece size kampanya veya reklam iletisi göndermeyiz.</li>
      </ul>

      <h2 id="kim-gorur">2. Bilgilerinizi kim görür?</h2>
      <h3>Teklif aşamasında</h3>
      <p>
        Bölgenizde hizmet veren ve belgeleri doğrulanmış firmalar talebinizin il/ilçe, kat, asansör, ev tipi, tarih,
        eşya ve not bilgilerini ve eklediğiniz fotoğraf/videoları görür. Adınız, telefonunuz ve açık adresiniz
        gösterilmez.
      </p>
      <h3>Teklif kabul edildikten sonra</h3>
      <p>
        Yalnızca teklifini kabul ettiğiniz firma adınızı, telefonunuzu, açık adresinizi ve harita konumunuzu görür; siz de firmanın
        yetkili adını ve telefonunu görürsünüz. Firma bu bilgileri yalnızca sizin taşımanız için kullanabilir.
      </p>
      <h3>Platform ekibi</h3>
      <p>
        Yetkili ekip üyelerimiz, firma doğrulaması, destek talepleri ve kötüye kullanımın önlenmesi için gerekli
        olduğunda kayıtlara erişebilir.
      </p>

      <h2 id="koruma">3. Bilgilerinizi nasıl koruyoruz?</h2>
      <ul>
        <li>Site ve uygulama yalnızca şifreli bağlantı (HTTPS) ile çalışır.</li>
        <li>Şifreniz geri döndürülemez biçimde özetlenerek saklanır; ekibimiz dahil kimse şifrenizi göremez.</li>
        <li>Doğrulama kodları 10 dakika geçerlidir, tek kullanımlıktır ve açık hâlde saklanmaz.</li>
        <li>Oturum çerezleri tarayıcıdaki betiklerin erişemeyeceği biçimde ayarlanır.</li>
        <li>
          Hata kayıtlarında telefon, adres, çerez ve form içerikleri tutulmaz; kayıtlar yalnızca hataları bulmak için
          kullanılır.
        </li>
        <li>Veritabanı her gece yedeklenir; yedekler web üzerinden erişilemeyen bir alanda 14 gün tutulur.</li>
      </ul>

      <h2 id="dosyalar">4. Fotoğraf, video ve belgeler</h2>
      <ul>
        <li>
          Fotoğraf ve videolar yüklenmeden önce tarayıcınızda küçültülür; bu sırada içlerindeki konum (GPS) bilgisi
          silinir.
        </li>
        <li>
          Talebe eklediğiniz fotoğraf ve videolar, talebi görebilen firmalara süreli ve imzalı bağlantılarla
          gösterilir; herkese açık bir adreste yayınlanmaz.
        </li>
        <li>
          Firma belgeleri (K3, vergi levhası, ticaret sicil, sigorta vb.) yalnızca firma sahibi ve doğrulama yapan
          yetkili ekibimiz tarafından görülebilir.
        </li>
        <li>
          Fotoğraf ve videolarda kişilerin yüzü, kimlik kartı, belge veya banka kartı görünmemesine dikkat etmenizi
          rica ederiz.
        </li>
      </ul>

      <h2 id="iletiler">5. E-posta ve bildirimler</h2>
      <p>
        Doğrulama kodları ve talep, teklif, iş durumuyla ilgili bildirimler hizmetin bir parçasıdır. Hangi
        bildirimleri e-posta ile almak istediğinizi hesabınızdaki bildirim ayarlarından seçebilirsiniz. Kampanya ve
        duyuru iletileri yalnızca{" "}
        <Link href="/acik-riza-metni">Açık Rıza Metni</Link> kapsamında izin verdiyseniz gönderilir ve her iletideki
        bağlantıyla veya bize yazarak izninizi geri alabilirsiniz.
      </p>

      <h2 id="silme">6. Hesabınızı ve verilerinizi silme</h2>
      <p>
        Hesabınızın silinmesini istediğinizde, kayıtlı e-posta adresinizden{" "}
        <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a> adresine yazabilirsiniz. Hesap silindiğinde
        ad, telefon, e-posta ve adres bilgileriniz silinir; talep fotoğraf/videoları ve firma belgeleri depodan kalıcı
        olarak kaldırılır. Planlanmış bir taşıma işi varsa silme işlemi iş tamamlandıktan veya iptal edildikten sonra
        yapılır. Kanunen saklamakla yükümlü olduğumuz kayıtlar bu sürelerin sonuna kadar saklanır.
      </p>

      <h2 id="cocuklar">7. 18 yaş altı</h2>
      <p>
        Platform 18 yaşından küçükler için tasarlanmamıştır ve bilerek 18 yaş altı kişilerden üyelik bilgisi
        toplamaz.
      </p>

      <h2 id="iletisim">8. İletişim</h2>
      <p>
        Gizlilikle ilgili sorularınız için <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>, diğer
        konular için <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> adresine yazabilirsiniz.
        Kullandığımız çerezlerin listesi <Link href="/cerez-politikasi">Çerez Politikası</Link>&apos;ndadır.
      </p>
    </LegalPage>
  );
}
