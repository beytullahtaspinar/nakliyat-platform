import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Faq, type FaqItem } from "@/components/local/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { MARKETING_PAGES } from "@/lib/marketing";
import { SITE_URL } from "@/lib/site";

const PATH = MARKETING_PAGES.howItWorks.href;
const TITLE = "Evden eve nakliyat teklifi nasıl alınır?";
const DESCRIPTION =
  "Taşınma talebini bir kez gir, doğrulanmış nakliyat firmalarından teklif al, fiyatı ve hizmet kapsamını karşılaştırıp seç. Adım adım nasıl çalıştığını öğren.";

export const metadata: Metadata = {
  title: "Nasıl Çalışır? Adım Adım Nakliyat Teklifi Alma",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const STEPS = [
  {
    title: "Taşınma talebini oluştur",
    text: "Nereden ve nereye taşınacağını, ev tipini, kat ve asansör durumunu, taşınma tarihini gir. İstersen konumu haritada işaretle, eşyalarının fotoğraf ve videosunu ekle, paketleme, montaj veya depolama gibi ek hizmetleri seç.",
  },
  {
    title: "Sistem işin boyutunu hesaplasın",
    text: "Girdiğin bilgilere göre tahmini eşya hacmi (m³), gereken ekip ve süre hesaplanır. Firmalar aynı standart bilgiye bakarak fiyat verir, bu yüzden teklifler birbiriyle karşılaştırılabilir olur.",
  },
  {
    title: "Doğrulanmış firmalar teklif versin",
    text: "Talebin, hizmet bölgesi o güzergâhı kapsayan ve belgeleri onaylanmış firmalara iletilir. Her firma talebine bir teklif verir: fiyat, ekip sayısı, araç tipi, paketleme, montaj ve sigortanın dahil olup olmadığı ve teklifin geçerlilik tarihi.",
  },
  {
    title: "Teklifleri karşılaştır ve seç",
    text: "Teklifleri fiyat, hizmet kapsamı, firma puanı ve yorumlarına göre yan yana gör. Sana uyanı tek tıkla kabul et; hiçbirini beğenmezsen kabul etmek zorunda değilsin.",
  },
  {
    title: "Firmayla anlaş, taşın",
    text: "Teklifi kabul ettiğinde iş kesinleşir. Açık adresin ve telefonun ancak bu aşamada yalnızca seçtiğin firmayla paylaşılır. Taşınma gününe kadar firmayla platform üzerinden mesajlaşabilirsin.",
  },
  {
    title: "Firmayı değerlendir",
    text: "Taşınma tamamlandığında firmaya 1 ile 5 arasında puan verip yorum yazabilirsin. Puanlar yalnızca o firmayla gerçekten taşınan müşterilerden gelir ve sonraki müşterilere yol gösterir.",
  },
];

const PRIVACY = [
  "Teklif aşamasında firmalar adını, telefonunu ve açık adresini görmez; yalnızca il, ilçe ve taşınma bilgilerini görür.",
  "İletişim bilgilerin yalnızca teklifini kabul ettiğin firmayla paylaşılır.",
  "Bir firma bir talebe tek teklif verir. Fiyatı güncellerse eski fiyatlar kayıt altında kalır.",
  "Yorumlar silinmez veya değiştirilmez; kurallara aykırı içerik gerekçesiyle gizlenebilir.",
];

const FAQ: FaqItem[] = [
  {
    question: "Teklif almak ücretli mi?",
    answer:
      "Hayır. Talep oluşturmak, teklif almak ve teklifleri karşılaştırmak ücretsizdir. Ödemeyi, teklifini kabul ettiğin nakliyat firmasına onunla anlaştığın şekilde yaparsın.",
  },
  {
    question: "Teklif almak beni bir firmaya bağlar mı?",
    answer:
      "Hayır. Gelen teklifleri inceleyip hiçbirini kabul etmeyebilirsin. İş yalnızca bir teklifi kendin kabul ettiğinde kesinleşir.",
  },
  {
    question: "Firmalar telefon numaramı görür mü?",
    answer:
      "Teklif aşamasında görmez. Telefonun ve açık adresin, yalnızca teklifini kabul ettiğin firmayla paylaşılır. Diğer firmalar seninle doğrudan iletişime geçemez.",
  },
  {
    question: "Teklif veren firmalar nasıl doğrulanıyor?",
    answer:
      "Firmalar teklif verebilmek için K3 yetki belgesi, vergi levhası ve ticaret sicil kaydını yükler; bu belgeler incelenip onaylanmadan firma hesabı açılmaz. K3 belgesinin süresi dolan firma yeni teklif veremez.",
  },
  {
    question: "Teklifler arasında nasıl karşılaştırma yapmalıyım?",
    answer:
      "Yalnızca fiyata değil, kapsama da bak: paketleme, montaj ve sigortanın fiyata dahil olup olmadığı, ekip sayısı, araç tipi ve firmanın gerçek müşterilerden aldığı puanlar toplam maliyeti ve riski belirler.",
  },
  {
    question: "Şehirler arası taşınmada da kullanabilir miyim?",
    answer:
      "Evet. Türkiye'nin 81 ilinde il içi, ilçeler arası ve şehirler arası taşınma için talep oluşturabilirsin. Talebin, çıkış ya da varış ilinde hizmet veren firmalara iletilir.",
  },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: "tr-TR",
  url: `${SITE_URL}${PATH}`,
  step: STEPS.map((step, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: step.title,
    text: step.text,
  })),
};

export default function HowItWorksPage() {
  return (
    <main className="flex-1">
      <JsonLd data={howToJsonLd} />
      <PageHero
        path={PATH}
        crumb="Nasıl çalışır?"
        eyebrow="Nasıl çalışır?"
        title="Taşınma bilgilerini bir kez gir, teklifler sana gelsin"
        lead="Firmaları tek tek aramak ve aynı bilgileri defalarca anlatmak yerine talebini bir kez oluşturursun. Doğrulanmış nakliyat firmaları fiyat ve hizmet kapsamıyla teklif verir, sen karşılaştırıp seçersin."
      >
        <ButtonLink href="/talep-olustur" size="lg">
          Ücretsiz teklif al <ArrowRightIcon className="h-5 w-5" />
        </ButtonLink>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Müşteriler için" title="Altı adımda taşınma" />
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full p-7">
                <span className="font-display text-sm font-bold text-accent-700">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-xl font-bold text-zinc-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-brand-900 text-white dark:bg-brand-950">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">Gizlilik ve güven</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Bilgilerin yalnızca seçtiğin firmaya gider</h2>
            <p className="mt-4 text-lg text-brand-100">
              Teklif toplamak telefonunun susmaması demek değil. Talebin firmalara kimliğin olmadan gösterilir.
            </p>
          </div>
          <ul className="grid gap-3">
            {PRIVACY.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-[0.95rem] font-medium"
              >
                <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading
            eyebrow="Nakliyat firmaları için"
            title="Firmalar nasıl katılıyor?"
            description="Platformda teklif veren her firma aynı doğrulama sürecinden geçer."
          />
          <ul className="space-y-3 text-zinc-700 dark:text-zinc-300">
            {[
              "Firma hesabı açılır, hizmet verilen iller ve firma bilgileri girilir.",
              "K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı yüklenir.",
              "Belgeler tek tek incelenir; zorunlu belgeler onaylanmadan firma teklif veremez.",
              "Onaylanan firma, hizmet bölgesindeki yeni talepleri görür ve teklif verir.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent-700" /> {item}
              </li>
            ))}
            <li className="pt-2">
              <Link
                href={MARKETING_PAGES.forCompanies.href}
                className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Firmalar için ayrıntılar <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <Faq items={FAQ} />
        <div className="mt-12 text-center">
          <ButtonLink href="/talep-olustur" size="lg">
            Hemen talep oluştur <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
