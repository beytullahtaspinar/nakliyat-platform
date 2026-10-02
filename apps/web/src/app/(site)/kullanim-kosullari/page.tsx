import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/legal";

const PATH = "/kullanim-kosullari";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description:
    "evdenevenakliyat.app'i kullanan müşteriler ve nakliyat firmaları için üyelik, talep, teklif, yorum ve sorumluluk kuralları.",
  alternates: { canonical: PATH },
};

const SECTIONS = [
  { id: "taraflar", title: "Taraflar ve tanımlar" },
  { id: "hizmet", title: "Platformun rolü" },
  { id: "uyelik", title: "Üyelik ve hesap güvenliği" },
  { id: "musteri", title: "Müşterilere ilişkin koşullar" },
  { id: "firma", title: "Nakliyat firmalarına ilişkin koşullar" },
  { id: "yorum", title: "Yorum ve içerik kuralları" },
  { id: "yasaklar", title: "Yasak kullanımlar" },
  { id: "sorumluluk", title: "Sorumluluğun sınırları" },
  { id: "fikri", title: "Fikri mülkiyet" },
  { id: "fesih", title: "Askıya alma ve hesabın kapatılması" },
  { id: "degisiklik", title: "Değişiklikler" },
  { id: "hukuk", title: "Uygulanacak hukuk ve uyuşmazlıklar" },
  { id: "iletisim", title: "İletişim" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Koşulları"
      path={PATH}
      sections={SECTIONS}
      intro={
        <p>
          Bu koşullar, {COMPANY.site} platformunu kullanan herkes için geçerlidir. Kayıt olarak veya platformu
          kullanarak bu koşulları kabul etmiş olursunuz. Kişisel verilerin işlenmesi{" "}
          <Link href="/kvkk-aydinlatma-metni" className="font-medium text-brand-700 underline">
            KVKK Aydınlatma Metni
          </Link>
          &apos;nde anlatılır.
        </p>
      }
    >
      <h2 id="taraflar">1. Taraflar ve tanımlar</h2>
      <ul>
        <li>
          <strong>Platform:</strong> {COMPANY.site} alan adında ve bağlı uygulamalarda sunulan hizmet; işleteni{" "}
          {COMPANY.title} ({COMPANY.address}, MERSİS: {COMPANY.mersis}).
        </li>
        <li>
          <strong>Müşteri:</strong> Taşınma talebi oluşturan ve teklif alan gerçek veya tüzel kişi.
        </li>
        <li>
          <strong>Firma:</strong> Platforma üye olan, belgeleri doğrulanan ve taleplere teklif veren nakliyat
          işletmesi ve onun adına hesabı kullanan yetkili.
        </li>
        <li>
          <strong>Talep:</strong> Müşterinin taşınma bilgilerini içeren ve uygun firmalara iletilen kayıt.
        </li>
        <li>
          <strong>Teklif:</strong> Firmanın bir talep için verdiği fiyat ve hizmet kapsamı.
        </li>
        <li>
          <strong>İş:</strong> Müşterinin bir teklifi kabul etmesiyle oluşan taşıma kaydı.
        </li>
      </ul>

      <h2 id="hizmet">2. Platformun rolü</h2>
      <p>
        Platform, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun anlamında bir aracı hizmet
        sağlayıcıdır. Müşteri ile firmayı bir araya getirir, taleplerin iletilmesini, tekliflerin karşılaştırılmasını
        ve işin kayda geçirilmesini sağlar.
      </p>
      <ul>
        <li>
          Taşıma sözleşmesi, teklif kabul edildiğinde doğrudan müşteri ile firma arasında kurulur. Platform bu
          sözleşmenin tarafı, taşıyıcısı veya komisyoncusu değildir.
        </li>
        <li>
          Taşımanın yapılması, eşyanın korunması, hasar ve kayıplar, sigorta ve ödemeler firmanın sorumluluğundadır.
        </li>
        <li>
          Platform, firmaların K3 yetki belgesini, vergi levhasını ve ticaret sicil kaydını kontrol eder. Bu kontrol,
          belgelerin yüklendiği tarihteki görünümüne dayanır; firmanın her taşımadaki hizmet kalitesinin garantisi
          değildir.
        </li>
        <li>Platformdaki tahmini hacim, ekip ve süre bilgileri yaklaşıktır; bağlayıcı olan firmanın teklifidir.</li>
      </ul>

      <h2 id="uyelik">3. Üyelik ve hesap güvenliği</h2>
      <ul>
        <li>Üye olmak için 18 yaşını doldurmuş ve fiil ehliyetine sahip olmak gerekir.</li>
        <li>
          Kayıtta verilen ad, telefon ve e-posta doğru ve size ait olmalıdır. Telefon ve e-posta doğrulanmadan talep
          yayınlanmaz, teklif verilemez ve teklif kabul edilemez.
        </li>
        <li>
          Şifrenizi ve hesabınıza erişimi korumak sizin sorumluluğunuzdadır. Hesabınızın izinsiz kullanıldığını
          düşünüyorsanız hemen şifrenizi değiştirip bize yazın.
        </li>
        <li>Bir kişi veya firma yalnızca bir hesap açabilir. Hesap başkasına devredilemez.</li>
      </ul>

      <h2 id="musteri">4. Müşterilere ilişkin koşullar</h2>
      <ul>
        <li>Talep oluşturmak, teklif almak ve karşılaştırmak müşteriler için ücretsizdir.</li>
        <li>
          Talepteki adres, kat, eşya ve tarih bilgilerini doğru girmeniz, firmaların doğru fiyat verebilmesi için
          gereklidir. Eksik veya yanlış bilgi nedeniyle taşıma günü ortaya çıkan fiyat farklarından Platform sorumlu
          değildir.
        </li>
        <li>
          Talebe eklediğiniz fotoğraf ve videolar, talebi gören firmalarla paylaşılır. Bunlarda kişilerin yüzü,
          kimlik, belge, banka kartı veya benzeri bilgiler görünmemelidir.
        </li>
        <li>
          Bir teklifi kabul ettiğinizde adınız, telefonunuz ve açık adresiniz yalnızca o firmayla paylaşılır. Fiyat,
          ödeme şekli, tarih ve hizmet kapsamının yazılı teyidini firmadan almanızı öneririz.
        </li>
        <li>
          Tüketici olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuattan doğan haklarınız
          saklıdır; bu hakları taşıma hizmetini veren firmaya karşı kullanabilirsiniz.
        </li>
      </ul>

      <h2 id="firma">5. Nakliyat firmalarına ilişkin koşullar</h2>
      <h3>Belgeler ve doğrulama</h3>
      <ul>
        <li>
          Firma, geçerli bir K3 yetki belgesine, vergi levhasına ve ticaret sicil kaydına sahip olmalı; bunları ve
          değişikliklerini Platforma eksiksiz ve güncel olarak yüklemelidir.
        </li>
        <li>
          Zorunlu belgeler onaylanmadan firma onaylanmaz ve teklif veremez. K3 belgesinin süresi dolduğunda yeni
          belge onaylanana kadar teklif verme durdurulur.
        </li>
        <li>
          Firma, yüklediği belgelerin gerçek ve kendisine ait olduğunu beyan eder. Sahte veya başkasına ait belge
          kullanımı hesabın kapatılması ve yasal yollara başvurulması sebebidir.
        </li>
      </ul>
      <h3>Teklifler ve işler</h3>
      <ul>
        <li>
          Teklif; fiyatı ve hizmet kapsamını (paketleme, montaj, sigorta vb.) açık ve dürüst biçimde içermelidir.
          Teklif kabul edildiğinde firma, teklifteki koşullarla işi yapmayı üstlenir.
        </li>
        <li>
          Taşıma sırasında doğan hasar ve kayıplardan, 6102 sayılı Türk Ticaret Kanunu, 2918 sayılı Karayolları Trafik
          Kanunu ve Karayolu Taşıma Yönetmeliği başta olmak üzere ilgili mevzuat çerçevesinde firma sorumludur.
        </li>
        <li>
          Firma, işin gerektirdiği izin, sigorta, araç ve personel yükümlülüklerini kendisi yerine getirir; Platform
          firmanın işvereni, ortağı veya temsilcisi değildir.
        </li>
        <li>
          Platform ücretli firma hizmetleri sunarsa, ücret ve koşulları önceden ayrıca bildirilir; firmanın onayı
          olmadan ücret yansıtılmaz.
        </li>
      </ul>
      <h3>Müşteri verilerinin korunması</h3>
      <ul>
        <li>
          Teklif kabul edildikten sonra firmayla paylaşılan müşteri adı, telefonu ve adresi yalnızca o taşıma işi
          için kullanılabilir. Bu bilgileri pazarlama, başka işler veya üçüncü kişilerle paylaşma amacıyla kullanmak
          yasaktır.
        </li>
        <li>
          Firma, bu bilgiler bakımından 6698 sayılı Kanun&apos;a göre ayrı bir veri sorumlusudur ve gerekli güvenlik
          tedbirlerini almakla yükümlüdür.
        </li>
      </ul>

      <h2 id="yorum">6. Yorum ve içerik kuralları</h2>
      <ul>
        <li>Yalnızca Platform üzerinden işi tamamlanan müşteriler o firma hakkında yorum ve puan verebilir.</li>
        <li>
          Yorumlar gerçek deneyime dayanmalıdır. Hakaret, tehdit, kişisel veri, reklam veya konu dışı içerik
          yayınlanmaz.
        </li>
        <li>
          Firmalar kendileri veya rakipleri hakkında yorum yazdıramaz, yorum karşılığında indirim veya menfaat sunamaz.
        </li>
        <li>
          Platform, bu kurallara veya mevzuata aykırı içerikleri kaldırabilir. Hukuka aykırı olduğunu düşündüğünüz bir
          içeriği <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> adresine bildirebilirsiniz.
        </li>
      </ul>

      <h2 id="yasaklar">7. Yasak kullanımlar</h2>
      <ul>
        <li>Başkası adına veya sahte bilgilerle hesap açmak, talep oluşturmak ya da teklif vermek</li>
        <li>Platformdaki iletişim bilgilerini toplu olarak toplamak, kopyalamak veya otomatik araçlarla taramak</li>
        <li>Platformun güvenliğini aşmaya, hizmeti aksatmaya veya başkalarının hesabına erişmeye çalışmak</li>
        <li>Zararlı yazılım, istenmeyen ileti veya hukuka aykırı içerik göndermek</li>
        <li>Platformu, amacı dışında veya mevzuata aykırı biçimde kullanmak</li>
      </ul>

      <h2 id="sorumluluk">8. Sorumluluğun sınırları</h2>
      <p>
        Platform, hizmetin kesintisiz ve hatasız çalışması için makul özeni gösterir; ancak bakım, altyapı arızası
        veya mücbir sebeplerle oluşan kesintilerden sorumlu tutulamaz. Platform; müşteri ile firma arasındaki taşıma
        sözleşmesinden, taşımanın yapılmasından, firmaların beyan ettiği bilgi ve fiyatlardan ve kullanıcıların
        yüklediği içeriklerden sorumlu değildir. Bu sınırlamalar, Platformun kast veya ağır ihmalinden doğan
        sorumluluğunu ve tüketicilerin kanundan doğan emredici haklarını kaldırmaz.
      </p>

      <h2 id="fikri">9. Fikri mülkiyet</h2>
      <p>
        Platformun adı, logosu, tasarımı, yazılımı ve Platform tarafından hazırlanan içerikler {COMPANY.title}
        &apos;a aittir; izinsiz kopyalanamaz ve kullanılamaz. Kullanıcılar yükledikleri içeriklerin hakkına sahip
        olduklarını beyan eder ve bu içeriklerin hizmetin sunulması için gereken ölçüde kullanılmasına izin verir.
      </p>

      <h2 id="fesih">10. Askıya alma ve hesabın kapatılması</h2>
      <ul>
        <li>
          Bu koşullara veya mevzuata aykırılık, sahte bilgi ya da belge, şikâyetlerin yoğunlaşması veya güvenlik riski
          hâlinde Platform hesabı askıya alabilir veya kapatabilir. Mümkün olduğunda gerekçe kullanıcıya bildirilir.
        </li>
        <li>
          Hesabınızı kapatmak istediğinizde <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
          adresine kayıtlı e-postanızdan yazabilirsiniz. Planlanmış bir taşıma işi varsa hesap, iş tamamlanana veya
          iptal edilene kadar kapatılamaz.
        </li>
        <li>
          Hesap kapatıldığında kişisel veriler{" "}
          <Link href="/kvkk-aydinlatma-metni#saklama">KVKK Aydınlatma Metni</Link>&apos;ndeki saklama kurallarına göre
          silinir.
        </li>
      </ul>

      <h2 id="degisiklik">11. Değişiklikler</h2>
      <p>
        Platform bu koşulları güncelleyebilir. Esaslı değişiklikler yürürlükten önce Platformda duyurulur ve kayıtlı
        e-posta adresinize bildirilir. Değişiklikten sonra Platformu kullanmaya devam etmeniz, güncel koşulları kabul
        ettiğiniz anlamına gelir. Kayıt sırasında kabul ettiğiniz sürüm ve tarih saklanır.
      </p>

      <h2 id="hukuk">12. Uygulanacak hukuk ve uyuşmazlıklar</h2>
      <p>
        Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketiciler, parasal sınırlar dahilinde yerleşim yerlerindeki
        tüketici hakem heyetlerine, bu sınırları aşan uyuşmazlıklarda tüketici mahkemelerine başvurabilir. Tüketici
        olmayan kullanıcılarla doğan uyuşmazlıklarda [şehir] mahkemeleri ve icra daireleri yetkilidir.
      </p>

      <h2 id="iletisim">13. İletişim</h2>
      <ul>
        <li>
          Destek ve şikâyetler: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
        </li>
        <li>
          Kişisel veri başvuruları: <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>
        </li>
        <li>Adres: {COMPANY.address}</li>
        <li>KEP: {COMPANY.kep}</li>
      </ul>
    </LegalPage>
  );
}
