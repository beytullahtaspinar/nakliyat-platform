# Yasal metinler (KVKK, kullanım koşulları, gizlilik, çerez, açık rıza)

> Metinler taslaktır. **Lansmandan önce avukat kontrolünden geçmeli.** Aşağıdaki yer tutucular doldurulmadan yayına çıkılmamalı.

## Sayfalar

| Adres | Dosya |
| --- | --- |
| /kullanim-kosullari | `apps/web/src/app/(site)/kullanim-kosullari/page.tsx` (genel + müşteri + firma bölümleri) |
| /kvkk-aydinlatma-metni | `apps/web/src/app/(site)/kvkk-aydinlatma-metni/page.tsx` |
| /gizlilik-politikasi | `apps/web/src/app/(site)/gizlilik-politikasi/page.tsx` (sade özet) |
| /cerez-politikasi | `apps/web/src/app/(site)/cerez-politikasi/page.tsx` |
| /acik-riza-metni | `apps/web/src/app/(site)/acik-riza-metni/page.tsx` (yalnızca ticari elektronik ileti) |

Ortak bilgiler (işleten adı, adres, vergi bilgisi, e-postalar, sürüm) tek yerde: `apps/web/src/lib/legal.ts`.
Bağlantılar altbilgide ve her yasal sayfanın sonunda; sayfalar sitemap'te.

## Doldurulacak yer tutucular (`lib/legal.ts` ve metin içi `[...]`)

- ~~İşleten bilgileri~~ girildi (2026-10-05): şahıs işletmesi, ticaret unvanı ve MERSİS yok; ad, adres ve VKN
  `lib/legal.ts`'te. **T.C. kimlik numarası hiçbir yerde yayınlanmaz ve kaydedilmez.** KEP adresi alınırsa
  aydınlatma metninin başvuru bölümüne eklenebilir. VERBİS kayıt yükümlülüğü avukatla kontrol edilmeli.
- `kvkk@` ve `destek@evdenevenakliyat.app` adreslerinin açılması (şu an yalnızca `bildirim@` var)
- Kayıtların ve erişim loglarının saklama süreleri (aydınlatma metni, 7. bölüm)
- Tüketici olmayanlar için yetkili mahkeme: işletme adresine göre Uşak yazıldı, avukat teyit etmeli
- Telefon doğrulama sağlayıcısı (Netgsm / WhatsApp) seçilince adı ve konumu

## Avukatın özellikle bakması gerekenler

1. **Yurt dışına aktarım (KVKK md. 9):** Cloudflare R2, Brevo, Sentry, Google/Apple, Photon/Nominatim,
   OpenRouteService, OpenFreeMap yurt dışında. Metin standart sözleşme + Kurul'a bildirim yolunu varsayıyor.
   Her sağlayıcı için standart sözleşmenin imzalanması ve 5 iş günü içinde Kurul'a bildirilmesi gerekir.
   Açık rıza bu aktarımlar için dayanak yapılmadı (hizmet için zorunlu olduğundan rıza "özgür" sayılmaz).
2. **Platformun rolü:** 6563 sayılı Kanun'a göre aracı hizmet sağlayıcı; taşıma sözleşmesi müşteri ile firma
   arasında. Firma, kabulden sonra aldığı müşteri verisi için ayrı veri sorumlusu.
3. **Firma ücretlendirmesi** başlarsa koşullara ücret bölümü ve gerekirse ayrı firma sözleşmesi eklenmeli.
4. **VERBİS** kayıt yükümlülüğü (çalışan sayısı / bilanço eşiği) kontrol edilmeli.
5. **İYS:** Kampanya iletisi gönderilmeye başlamadan İleti Yönetim Sistemi kaydı yapılmalı.

## Kayıtta alınan onaylar

Kayıt formlarında (kayıt, Google/Apple kaydını tamamlama, talep formunda hesap açma) iki kutu var:

- **Zorunlu:** "Kullanım koşullarını kabul ediyorum, KVKK aydınlatma metnini okudum." Aydınlatma bir rıza
  değildir; okunduğunun teyidi olarak alınır.
- **İsteğe bağlı:** "Kampanya ve duyurulardan haberdar olmak istiyorum" (açık rıza metni). İşaretlenmemesi kaydı
  engellemez.

API kabul anını ve sürümü saklar: `User.termsAcceptedAt`, `User.termsVersion`, `User.marketingConsentAt`.
Sürüm `LEGAL_VERSION` (`lib/legal.ts`). Koşullarda esaslı değişiklik olursa `LEGAL_VERSION` ve `LEGAL_UPDATED`
güncellenir, kullanıcılara e-postayla duyurulur.

Henüz yapılmadı: hesabımdan ileti iznini geri alma düğmesi ve kampanya gönderimi (gönderim başlarken eklenecek;
o zamana kadar izin yalnızca kaydedilir, ileti gönderilmez).

## Çerezler

Yalnızca zorunlu, birinci taraf çerezler var (`nk_at`, `nk_rt`, `nk_rol`, `nk_oauth`, `nk_kayit`, yöneticiler için `nk_firma_gorunum`) ve bir
sessionStorage anahtarı (`nk_surum_yenileme`). Analiz/reklam çerezi olmadığı için çerez onay bandı yok
(PageSpeed'e de yük getirmez). Analiz veya reklam aracı eklenirse önce onay bandı eklenmeli ve çerez politikası
güncellenmeli. Yeni çerez eklendiğinde çerez politikasındaki tablo güncellenmeli.
