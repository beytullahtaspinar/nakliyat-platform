import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, TableScroll } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/legal";

const PATH = "/kvkk-aydinlatma-metni";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "evdenevenakliyat.app'te hangi kişisel verilerin, hangi amaçla ve hukuki sebeple işlendiği, kimlere aktarıldığı ve 6698 sayılı Kanun kapsamındaki haklarınız.",
  alternates: { canonical: PATH },
};

const SECTIONS = [
  { id: "veri-sorumlusu", title: "Veri sorumlusu" },
  { id: "islenen-veriler", title: "İşlenen kişisel veriler" },
  { id: "amaclar", title: "İşleme amaçları ve hukuki sebepler" },
  { id: "toplama", title: "Toplama yöntemi" },
  { id: "aktarim", title: "Kişisel verilerin aktarılması" },
  { id: "yurt-disi", title: "Yurt dışına aktarım" },
  { id: "saklama", title: "Saklama süreleri" },
  { id: "haklar", title: "Kanun'un 11. maddesindeki haklarınız" },
  { id: "basvuru", title: "Başvuru yolu" },
];

export default function KvkkPage() {
  return (
    <LegalPage
      title="KVKK Aydınlatma Metni"
      path={PATH}
      sections={SECTIONS}
      intro={
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;Kanun&quot;) 10. maddesi ve Aydınlatma
          Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, {COMPANY.site}{" "}
          platformunu kullanan müşterileri, nakliyat firması yetkililerini ve ziyaretçileri bilgilendirmek için
          hazırlanmıştır.
        </p>
      }
    >
      <h2 id="veri-sorumlusu">1. Veri sorumlusu</h2>
      <p>
        Kişisel verileriniz, veri sorumlusu sıfatıyla, {COMPANY.site} platformunu (&quot;Platform&quot;) şahıs
        işletmesi olarak işleten {COMPANY.title} tarafından işlenmektedir.
      </p>
      <ul>
        <li>Adres: {COMPANY.address}</li>
        <li>Vergi bilgisi: {COMPANY.taxInfo}</li>
        <li>
          E-posta: <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>
        </li>
      </ul>
      <p>
        Platform, taşınmak isteyen kişiler ile nakliyat firmalarını bir araya getiren aracı bir hizmettir. Taşıma
        işini kabul eden nakliyat firması, kendisine iletilen müşteri bilgileri bakımından ayrı bir veri sorumlusudur
        ve bu bilgileri yalnızca o taşıma için kullanmakla yükümlüdür.
      </p>

      <h2 id="islenen-veriler">2. İşlenen kişisel veriler</h2>
      <TableScroll label="İşlenen kişisel veri kategorileri">
        <table>
          <thead>
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">Örnekler</th>
              <th scope="col">Kimin verisi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Kimlik</td>
              <td>Ad soyad</td>
              <td>Müşteri, firma yetkilisi</td>
            </tr>
            <tr>
              <td>İletişim</td>
              <td>Cep telefonu, e-posta adresi</td>
              <td>Müşteri, firma yetkilisi</td>
            </tr>
            <tr>
              <td>Taşınma talebi</td>
              <td>
                Çıkış ve varış adresi ve harita konumu, il/ilçe, kat ve asansör bilgisi, ev tipi, taşınma tarihi, özel
                eşyalar, notlar
              </td>
              <td>Müşteri</td>
            </tr>
            <tr>
              <td>Görsel kayıt</td>
              <td>Talebe eklenen eşya ve ev içi fotoğraf ve videoları</td>
              <td>Müşteri</td>
            </tr>
            <tr>
              <td>Müşteri işlem</td>
              <td>Teklifler, teklif geçmişi, kabul edilen işler, yorum ve puanlar, bildirim tercihleri</td>
              <td>Müşteri, firma yetkilisi</td>
            </tr>
            <tr>
              <td>Mesleki ve ticari</td>
              <td>
                Firma unvanı, hizmet bölgeleri, K3 yetki belgesi, vergi levhası, ticaret sicil kaydı, sigorta poliçesi ve
                diğer yüklenen belgeler (belgelerde yer alan kimlik bilgileri dahil)
              </td>
              <td>Firma yetkilisi</td>
            </tr>
            <tr>
              <td>İşlem güvenliği</td>
              <td>
                Şifrenin geri döndürülemez özeti, oturum anahtarları, doğrulama kodlarının özeti, IP adresi, tarayıcı
                bilgisi, hata ve erişim kayıtları
              </td>
              <td>Tüm kullanıcılar</td>
            </tr>
            <tr>
              <td>Bağlı hesap</td>
              <td>Google veya Apple ile girişte bu hizmetlerin paylaştığı hesap kimliği, ad ve e-posta</td>
              <td>Bu yolla giriş yapanlar</td>
            </tr>
            <tr>
              <td>Hukuki işlem ve onay kayıtları</td>
              <td>Kullanım koşullarını kabul tarihi ve sürümü, verilen izinler, başvuru ve şikâyet yazışmaları</td>
              <td>Tüm kullanıcılar</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <p>
        Platform, Kanun&apos;un 6. maddesindeki özel nitelikli kişisel verileri (sağlık, din, biyometrik veri vb.)
        talep etmez. Talebe eklediğiniz fotoğraf ve videolarda kişilerin yüzü, kimlik kartı, belge veya bu tür
        bilgiler görünmemesine lütfen dikkat edin.
      </p>

      <h2 id="amaclar">3. İşleme amaçları ve hukuki sebepler</h2>
      <TableScroll label="İşleme amaçları ve hukuki sebepler">
        <table>
          <thead>
            <tr>
              <th scope="col">Amaç</th>
              <th scope="col">Hukuki sebep (Kanun md. 5/2)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Üyelik açmak, giriş yapmak, hesabı yönetmek</td>
              <td>(c) Sözleşmenin kurulması ve ifası</td>
            </tr>
            <tr>
              <td>Taşınma talebini oluşturmak, uygun firmalara iletmek, teklifleri ve kabul edilen işi yönetmek</td>
              <td>(c) Sözleşmenin kurulması ve ifası</td>
            </tr>
            <tr>
              <td>Telefon ve e-posta doğrulaması, sahte hesap ve kötüye kullanımın önlenmesi</td>
              <td>(f) Meşru menfaat, (c) sözleşmenin ifası</td>
            </tr>
            <tr>
              <td>Firmaların K3 belgesi ve ticari kayıtlarının doğrulanması</td>
              <td>(c) Sözleşmenin ifası, (f) meşru menfaat (müşterilerin yetkisiz taşıyıcılardan korunması)</td>
            </tr>
            <tr>
              <td>Talep, teklif ve iş durumuyla ilgili bildirim ve e-postalar</td>
              <td>(c) Sözleşmenin ifası</td>
            </tr>
            <tr>
              <td>Bilgi güvenliği, hata takibi, yedekleme, hizmetin sürekliliği</td>
              <td>(ç) Hukuki yükümlülük, (f) meşru menfaat</td>
            </tr>
            <tr>
              <td>Yasal yükümlülükler, yetkili makamların talepleri, uyuşmazlıklarda delil</td>
              <td>(ç) Hukuki yükümlülük, (e) bir hakkın tesisi, kullanılması veya korunması</td>
            </tr>
            <tr>
              <td>Kampanya, duyuru ve bülten gönderimi (ticari elektronik ileti)</td>
              <td>
                Açık rıza (Kanun md. 5/1) ve 6563 sayılı Kanun kapsamında onay. Bkz.{" "}
                <Link href="/acik-riza-metni">Açık Rıza Metni</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <p>Kişisel verileriniz, açık rızanız olmadan reklam veya profil çıkarma amacıyla kullanılmaz ve satılmaz.</p>

      <h2 id="toplama">4. Toplama yöntemi</h2>
      <p>Kişisel verileriniz şu yollarla, elektronik ortamda toplanır:</p>
      <ul>
        <li>Kayıt, giriş, talep, teklif, firma bilgileri ve belge yükleme formları</li>
        <li>Google veya Apple ile giriş yapmayı seçtiğinizde bu hizmetlerin bize ilettiği bilgiler</li>
        <li>
          Platformu kullanırken otomatik oluşan kayıtlar ve zorunlu çerezler (bkz.{" "}
          <Link href="/cerez-politikasi">Çerez Politikası</Link>)
        </li>
        <li>Destek ve KVKK başvurusu için bize yazdığınız e-postalar</li>
      </ul>

      <h2 id="aktarim">5. Kişisel verilerin aktarılması</h2>
      <h3>Nakliyat firmaları</h3>
      <p>
        Talebiniz, hizmet bölgesi uyan ve Platform tarafından doğrulanmış nakliyat firmalarına iletilir. Teklif
        aşamasında firmalar yalnızca il/ilçe, mesafe, kat, asansör, ev tipi, tarih, eşya bilgileri, notlar ve eklediğiniz
        fotoğraf/videoları görür; adınız, telefonunuz ve açık adresiniz gösterilmez. Bir teklifi kabul ettiğinizde ad
        soyad, telefon, açık adresiniz ve harita konumunuz yalnızca o firmayla, taşıma işinin yapılması için paylaşılır (Kanun md. 8/2-a,
        5/2-c). Kabul ettiğiniz firmanın yetkili adı ve telefonu da size gösterilir.
      </p>
      <h3>Hizmet sağlayıcılar (veri işleyenler)</h3>
      <TableScroll label="Hizmet sağlayıcılar">
        <table>
          <thead>
            <tr>
              <th scope="col">Hizmet sağlayıcı</th>
              <th scope="col">Hizmet</th>
              <th scope="col">Konum</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Veridyen</td>
              <td>Sunucu barındırma, veritabanı, e-posta</td>
              <td>Türkiye</td>
            </tr>
            <tr>
              <td>Cloudflare (R2)</td>
              <td>Talep fotoğraf/videoları ve firma belgelerinin depolanması</td>
              <td>Yurt dışı</td>
            </tr>
            <tr>
              <td>Brevo</td>
              <td>Doğrulama kodu ve bildirim e-postalarının gönderimi</td>
              <td>Yurt dışı (AB)</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Hata takibi (iletişim bilgisi ve adres gönderilmez)</td>
              <td>Yurt dışı</td>
            </tr>
            <tr>
              <td>Google, Apple</td>
              <td>Yalnızca bu yolla giriş yapmayı seçenler için kimlik doğrulama</td>
              <td>Yurt dışı</td>
            </tr>
            <tr>
              <td>Photon (Komoot), Nominatim (OpenStreetMap)</td>
              <td>Adres arama ve konum önerisi (yazdığınız adres metni gönderilir)</td>
              <td>Yurt dışı (AB)</td>
            </tr>
            <tr>
              <td>OpenRouteService (HeiGIT)</td>
              <td>Çıkış ve varış noktaları arasındaki rota ve mesafenin hesaplanması (yalnızca konum bilgisi)</td>
              <td>Yurt dışı (AB)</td>
            </tr>
            <tr>
              <td>OpenFreeMap</td>
              <td>Harita görüntüsü (tarayıcınızın IP adresi ve görüntülenen harita bölgesi)</td>
              <td>Yurt dışı</td>
            </tr>
            <tr>
              <td>SMS / WhatsApp doğrulama sağlayıcısı</td>
              <td>Telefon doğrulama kodu gönderimi (devreye alındığında)</td>
              <td>Devreye alındığında belirtilecek</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <h3>Diğer alıcılar</h3>
      <p>
        Kanunen yetkili kamu kurum ve kuruluşları ile yargı mercileri, talep etmeleri hâlinde ve mevzuatın izin verdiği
        ölçüde (Kanun md. 8/2-a, 5/2-ç). Hukuki danışmanlarımız ve denetçilerimiz, bir hakkın korunması için gerekli
        olduğu ölçüde.
      </p>

      <h2 id="yurt-disi">6. Yurt dışına aktarım</h2>
      <p>
        Yukarıda yurt dışında olduğu belirtilen hizmet sağlayıcılara aktarım, Kanun&apos;un 9. maddesine uygun olarak,
        Kişisel Verileri Koruma Kurulu&apos;nun ilan ettiği standart sözleşmeler imzalanarak ve Kurul&apos;a
        bildirilerek yapılır.
      </p>

      <h2 id="saklama">7. Saklama süreleri</h2>
      <ul>
        <li>
          Hesap bilgileri ve talepler: hesabınız açık olduğu sürece. Hesabınız silindiğinde ad, telefon, e-posta ve
          açık adres gibi kişisel verileriniz silinir; talep fotoğraf/videoları ve firma belgeleri depodan kalıcı
          olarak kaldırılır.
        </li>
        <li>
          Kabul edilen işlere ilişkin kayıtlar ve onay kayıtları: olası uyuşmazlıklar için genel zamanaşımı süresi (10 yıl)
          boyunca.
        </li>
        <li>Doğrulama kodları: en fazla 10 dakika geçerlidir; yalnızca geri döndürülemez özetleri saklanır.</li>
        <li>Veritabanı yedekleri: 14 gün sonra silinir.</li>
        <li>Erişim ve hata kayıtları: mevzuatın öngördüğü süre boyunca.</li>
      </ul>
      <p>
        Süresi dolan veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında
        Yönetmelik&apos;e uygun olarak silinir veya anonim hale getirilir.
      </p>

      <h2 id="haklar">8. Kanun&apos;un 11. maddesindeki haklarınız</h2>
      <p>Veri sorumlusuna başvurarak:</p>
      <ul>
        <li>Kişisel verilerinin işlenip işlenmediğini öğrenme,</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
        <li>İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>Kanun&apos;un 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,</li>
        <li>Düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
        <li>
          Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonucun ortaya çıkmasına itiraz etme,
        </li>
        <li>Kanuna aykırı işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme</li>
      </ul>
      <p>haklarına sahipsiniz.</p>

      <h2 id="basvuru">9. Başvuru yolu</h2>
      <p>
        Başvurunuzu, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ&apos;e uygun olarak ad soyad, imza (yazılı
        başvurularda), T.C. kimlik numarası (yabancılar için uyruk ve pasaport numarası), tebligata esas adres,
        varsa e-posta ve telefon bilgilerini ve talebinizi içerecek şekilde:
      </p>
      <ul>
        <li>Yazılı olarak {COMPANY.address} adresine,</li>
        <li>
          Platformda kayıtlı e-posta adresinden <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>{" "}
          adresine
        </li>
      </ul>
      <p>
        iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca bir maliyet
        gerektirmesi hâlinde Kurul&apos;un belirlediği tarife uygulanabilir. Başvurunun reddedilmesi, cevabın yetersiz
        bulunması veya süresinde cevap verilmemesi hâlinde Kişisel Verileri Koruma Kurulu&apos;na şikâyette
        bulunabilirsiniz.
      </p>
    </LegalPage>
  );
}
