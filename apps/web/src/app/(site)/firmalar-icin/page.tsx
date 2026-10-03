import type { Metadata } from "next";
import { Faq, type FaqItem } from "@/components/local/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, SectionHeading } from "@/components/ui/card";
import {
  ArrowRightIcon,
  ClipboardIcon,
  CompareIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { DOCUMENT_TYPES } from "@/lib/company-documents";
import { COMPANY_SIGNUP_PATH, MARKETING_PAGES } from "@/lib/marketing";

const PATH = MARKETING_PAGES.forCompanies.href;

export const metadata: Metadata = {
  title: "Nakliyat Firmaları İçin: Bölgendeki Taşıma Taleplerine Teklif Ver",
  description:
    "Evden eve nakliyat firması olarak platforma katıl: hizmet verdiğin illerdeki gerçek taşınma taleplerini gör, teklif ver, iyi hizmetini müşteri puanlarıyla görünür kıl.",
  alternates: { canonical: PATH },
};

const BENEFITS = [
  {
    icon: MapPinIcon,
    title: "Bölgendeki gerçek talepler",
    text: "Hizmet verdiğin illerden çıkan ya da o illere gelen taşınma talepleri panelinde listelenir, yeni talep geldiğinde haber verilir.",
  },
  {
    icon: ClipboardIcon,
    title: "Fiyatlamaya hazır bilgi",
    text: "Ev tipi, kat, asansör, ek hizmetler, fotoğraf ve videolar ile tahmini eşya hacmi, ekip ve süre tek ekranda. Keşfe gitmeden fiyat verebilirsin.",
  },
  {
    icon: CompareIcon,
    title: "Fiyatla değil, hizmetle de öne çık",
    text: "Teklifinde paketleme, montaj ve sigortanın dahil olup olmadığını, ekip ve aracını belirtirsin. Müşteri yalnızca fiyatı değil, kapsamı da görür.",
  },
  {
    icon: StarIcon,
    title: "Puanların senin vitrinin",
    text: "İşi tamamladığın müşteriler seni puanlar ve yorum yazar, sen de yorumlara yanıt verirsin. Yorumların herkese açık firma sayfanda görünür.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Belgeli firmalar arasında yarış",
    text: "Platformda yalnızca K3 yetki belgesi ve şirket belgeleri onaylanmış firmalar teklif verir. Belgesiz, kayıt dışı rekabetle karşılaşmazsın.",
  },
  {
    icon: TruckIcon,
    title: "İşi tek panelden yönet",
    text: "Tekliflerin, kesinleşen işlerin, müşteriyle mesajlaşma ve değerlendirmeler firma panelinde. Telefondan da kullanabilirsin.",
  },
];

const JOIN_STEPS = [
  {
    title: "Firma hesabını aç",
    text: "Cep telefonunla kaydol, firma adını ve hizmet verdiğin illeri gir.",
  },
  {
    title: "Belgelerini yükle",
    text: "K3 yetki belgesi, vergi levhası ve ticaret sicil belgeni PDF ya da fotoğraf olarak panelden yükle.",
  },
  {
    title: "Onayı bekle",
    text: "Belgeler tek tek incelenir. Eksik ya da hatalı belge olursa gerekçesiyle bildirilir, yenisini yükleyebilirsin.",
  },
  {
    title: "Teklif vermeye başla",
    text: "Onaylandığında hizmet bölgendeki açık talepleri görür, her talebe bir teklif verirsin.",
  },
];

const FAQ: FaqItem[] = [
  {
    question: "Platforma katılmak ücretli mi?",
    answer:
      "Şu an firma kaydı ve teklif vermek ücretsizdir. İleride ücretli bir firma hizmeti sunulursa, ücret ve koşullar önceden ayrıca bildirilir; onayın olmadan sana ücret yansıtılmaz.",
  },
  {
    question: "K3 yetki belgem yoksa katılabilir miyim?",
    answer:
      "Hayır. Evden eve eşya taşımacılığı için Ulaştırma ve Altyapı Bakanlığı'nın K3 yetki belgesi gerekir. Belgesi onaylanmayan firma teklif veremez; onaylı K3 belgesinin süresi dolduğunda da yeni teklif verilemez.",
  },
  {
    question: "Müşterinin telefonunu ne zaman görürüm?",
    answer:
      "Teklif aşamasında talebin il, ilçe ve taşınma bilgilerini görürsün; müşterinin adı, telefonu ve açık adresi gizlidir. Müşteri senin teklifini kabul ettiğinde iletişim bilgileri ve açık adres sana açılır.",
  },
  {
    question: "Verdiğim teklifi değiştirebilir miyim?",
    answer:
      "Evet. Müşteri kabul etmeden önce teklifini güncelleyebilir ya da geri çekebilirsin. Fiyat değişiklikleri kayıt altında tutulur.",
  },
  {
    question: "Hangi illerdeki talepleri görürüm?",
    answer:
      "Firma profilinde seçtiğin hizmet illerinden çıkan ya da o illere giden talepleri görürsün. Hizmet bölgeni istediğin zaman profilinden değiştirebilirsin.",
  },
  {
    question: "Kötü bir yorumu kaldırabilir miyim?",
    answer:
      "Yorumlar yalnızca seninle işi tamamlanan müşterilerden gelir ve firma tarafından silinemez. Her yoruma bir kez herkese açık yanıt yazabilirsin. Kurallara aykırı içerik yönetim tarafından gerekçesiyle gizlenebilir.",
  },
];

export default function ForCompaniesPage() {
  return (
    <main className="flex-1">
      <PageHero
        path={PATH}
        crumb="Firmalar için"
        eyebrow="Nakliyat firmaları için"
        title="Bölgendeki taşınma taleplerine teklif ver, işini büyüt"
        lead="Müşteri bulmak için ilan ve reklama bütçe ayırmak yerine, hizmet verdiğin illerde taşınmaya hazırlanan müşterilerin taleplerini gör. Teklifini ver, iyi hizmetini gerçek müşteri puanlarıyla görünür kıl."
      >
        <ButtonLink href={COMPANY_SIGNUP_PATH} size="lg">
          Firma olarak katıl <ArrowRightIcon className="h-5 w-5" />
        </ButtonLink>
        <ButtonLink href="/giris?next=/firma-paneli" size="lg" variant="secondary">
          Firma paneline giriş
        </ButtonLink>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Neden katılmalısın?" title="Talep sana gelsin, sen işine odaklan" />
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <Icon />
              </span>
              <h3 className="mt-4 font-bold text-zinc-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-zinc-50 py-20 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            align="center"
            eyebrow="Nasıl katılırım?"
            title="Dört adımda teklif vermeye başla"
          />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {JOIN_STEPS.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full p-6">
                  <span className="font-display text-sm font-bold text-accent-700">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading
            eyebrow="Doğrulama"
            title="İstenen belgeler"
            description="Belgeleri PDF, JPG, PNG ya da WEBP olarak, dosya başına en fazla 10 MB yükleyebilirsin."
          />
          <ul className="space-y-3">
            {DOCUMENT_TYPES.map((doc) => (
              <li key={doc.type}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{doc.label}</h3>
                    <Badge tone={doc.required ? "brand" : "neutral"}>{doc.required ? "Zorunlu" : "İsteğe bağlı"}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{doc.hint}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Faq items={FAQ} />
      </div>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-accent-50 to-accent-100 p-8 sm:p-12 md:grid-cols-[1fr_auto] dark:from-accent-950 dark:to-zinc-900">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Firmanı birkaç dakikada kaydet</h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              Kayıt ücretsiz. Belgelerin onaylanınca bölgendeki taleplere teklif vermeye başlayabilirsin.
            </p>
          </div>
          <ButtonLink href={COMPANY_SIGNUP_PATH} size="lg">
            Firma olarak katıl <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
