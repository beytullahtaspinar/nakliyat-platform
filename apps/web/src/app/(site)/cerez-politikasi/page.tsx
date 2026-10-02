import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, TableScroll } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/legal";

const PATH = "/cerez-politikasi";

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description:
    "evdenevenakliyat.app yalnızca oturum ve güvenlik için zorunlu çerezler kullanır; reklam veya takip çerezi kullanmaz. Kullanılan çerezlerin listesi.",
  alternates: { canonical: PATH },
};

const SECTIONS = [
  { id: "cerez-nedir", title: "Çerez nedir?" },
  { id: "kullandiklarimiz", title: "Kullandığımız çerezler" },
  { id: "kullanmadiklarimiz", title: "Kullanmadığımız çerezler" },
  { id: "ucuncu-taraf", title: "Üçüncü taraf sayfalar" },
  { id: "yonetim", title: "Çerezleri yönetme" },
  { id: "degisiklik", title: "Değişiklikler" },
];

const COOKIES = [
  {
    name: "nk_at",
    purpose: "Oturum: giriş yaptığınızı doğrulayan kısa ömürlü erişim anahtarı",
    duration: "14 dakika",
  },
  {
    name: "nk_rt",
    purpose: "Oturum: erişim anahtarını yenileyip oturumunuzu açık tutar",
    duration: "30 gün (çıkış yapınca silinir)",
  },
  { name: "nk_rol", purpose: "Oturum: üst menüde doğru hesap bağlantısını göstermek", duration: "30 gün" },
  {
    name: "nk_oauth",
    purpose: "Güvenlik: Google/Apple ile girişte isteğin size ait olduğunu doğrular",
    duration: "10 dakika",
  },
  {
    name: "nk_kayit",
    purpose: "Google/Apple ile kayıtta, kaydı tamamlayana kadar geçici kimlik",
    duration: "20 dakika",
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Çerez Politikası"
      path={PATH}
      sections={SECTIONS}
      intro={
        <p>
          {COMPANY.site} yalnızca platformun çalışması ve hesabınızın güvenliği için zorunlu olan çerezleri kullanır.
          Reklam, takip veya analiz çerezi kullanmaz; bu yüzden çerez onayı istemeyiz.
        </p>
      }
    >
      <h2 id="cerez-nedir">1. Çerez nedir?</h2>
      <p>
        Çerez, ziyaret ettiğiniz sitenin tarayıcınıza kaydettiği küçük bir metin dosyasıdır. Benzer amaçla
        tarayıcının yerel depolama alanları da kullanılabilir; bu politikada hepsine &quot;çerez&quot; diyoruz.
      </p>

      <h2 id="kullandiklarimiz">2. Kullandığımız çerezler</h2>
      <p>
        Aşağıdaki çerezlerin tamamı birinci taraf ve zorunlu çerezdir. Kişisel Verileri Koruma Kurumu&apos;nun Çerez
        Uygulamaları Hakkında Rehberi uyarınca, kullanıcının açıkça talep ettiği hizmetin sunulması için zorunlu olan
        çerezler açık rızaya tabi değildir; bunlar sözleşmenin ifası ve meşru menfaat hukuki sebeplerine dayanır
        (Kanun md. 5/2-c ve f).
      </p>
      <TableScroll label="Kullanılan çerezler">
        <table>
          <thead>
            <tr>
              <th scope="col">Ad</th>
              <th scope="col">Amaç</th>
              <th scope="col">Süre</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name}>
                <td>
                  <code>{c.name}</code>
                </td>
                <td>{c.purpose}</td>
                <td>{c.duration}</td>
              </tr>
            ))}
            <tr>
              <td>
                <code>nk_surum_yenileme</code>
              </td>
              <td>
                Oturum depolaması: site güncellendiğinde sayfanın yalnızca bir kez yenilenmesini sağlar
              </td>
              <td>Sekme kapanınca silinir</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <p>
        Çerezlerin tamamı yalnızca güvenli bağlantı üzerinden gönderilir (Secure) ve başka sitelerin arka planda yaptığı
        isteklerde gönderilmez (SameSite=Lax). Oturum anahtarları ve giriş çerezleri ayrıca tarayıcıdaki betiklerin erişemeyeceği
        biçimde (HttpOnly) ayarlanır.
      </p>

      <h2 id="kullanmadiklarimiz">3. Kullanmadığımız çerezler</h2>
      <p>
        Reklam, yeniden pazarlama, sosyal medya takip pikseli veya ziyaretçi analizi çerezi kullanmıyoruz. İleride
        bu tür bir çerez eklenirse, kullanılmadan önce açık rızanız istenecek ve bu politika güncellenecektir.
      </p>

      <h2 id="ucuncu-taraf">4. Üçüncü taraf sayfalar</h2>
      <p>
        Google veya Apple ile giriş yapmayı seçtiğinizde bu şirketlerin kendi sayfalarına yönlendirilirsiniz. Bu
        sayfalarda kullanılan çerezler Google ve Apple&apos;ın kendi politikalarına tabidir.
      </p>

      <h2 id="yonetim">5. Çerezleri yönetme</h2>
      <p>
        Tarayıcınızın ayarlarından çerezleri görebilir ve silebilirsiniz. Zorunlu çerezleri engellerseniz giriş
        yapamaz ve hesabınızı kullanamazsınız; herkese açık sayfalar ise çalışmaya devam eder.
      </p>

      <h2 id="degisiklik">6. Değişiklikler</h2>
      <p>
        Bu politika, kullandığımız çerezler değiştikçe güncellenir. Kişisel verilerinizin işlenmesi hakkında ayrıntılı
        bilgi için <Link href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</Link>&apos;ni inceleyebilirsiniz.
      </p>
    </LegalPage>
  );
}
