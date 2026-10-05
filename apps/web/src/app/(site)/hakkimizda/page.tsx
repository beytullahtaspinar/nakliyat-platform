import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { ArrowRightIcon, CheckIcon, CompareIcon, ShieldCheckIcon, StarIcon, UsersIcon } from "@/components/ui/icons";
import { COMPANY, COMPANY_INFO_READY } from "@/lib/legal";
import { HUB_PATH } from "@/lib/local-content";
import { MARKETING_PAGES } from "@/lib/marketing";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = MARKETING_PAGES.about.href;
const DESCRIPTION =
  "evdenevenakliyat.app, Türkiye genelinde taşınacak kişileri belgeleri doğrulanmış nakliyat firmalarıyla buluşturan bağımsız bir platformdur. Neden kurulduğunu ve hangi ilkelerle çalıştığını öğren.";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const PROBLEMS = [
  "Aynı taşınma için firmalara tek tek ulaşıp aynı bilgileri defalarca anlatmak",
  "Kapsamı belli olmayan, birbiriyle karşılaştırılamayan fiyatlar",
  "Firmanın yetki belgesi olup olmadığını bilmeden eşyaları emanet etmek",
  "Kimin yazdığı belli olmayan, doğrulanamayan yorumlar",
];

const PRINCIPLES = [
  {
    icon: ShieldCheckIcon,
    title: "Önce doğrulama",
    text: "Teklif veren her firmanın K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı tek tek incelenir. Belgesi onaylanmayan ya da süresi dolan firma teklif veremez.",
  },
  {
    icon: StarIcon,
    title: "Yalnızca gerçek yorumlar",
    text: "Bir firmayı yalnızca onunla taşınması tamamlanan müşteri değerlendirebilir. Her iş için tek yorum yazılır, sonradan değiştirilemez.",
  },
  {
    icon: CompareIcon,
    title: "Karşılaştırılabilir teklifler",
    text: "Firmalar aynı standart bilgiye bakarak fiyat verir ve paketleme, montaj, sigorta gibi kapsamı açıkça belirtir. Teklif fiyatlarındaki değişiklikler kayıt altında tutulur.",
  },
  {
    icon: UsersIcon,
    title: "Kişisel verine saygı",
    text: "Teklif aşamasında firmalar adını, telefonunu ve açık adresini görmez. Bu bilgiler yalnızca teklifini kabul ettiğin firmayla paylaşılır.",
  },
];

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}${PATH}`,
  url: `${SITE_URL}${PATH}`,
  name: `Hakkımızda | ${SITE_NAME}`,
  description: DESCRIPTION,
  inLanguage: "tr-TR",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#organization` },
};

export default function AboutPage() {
  return (
    <main className="flex-1">
      <JsonLd data={aboutJsonLd} />
      <PageHero
        path={PATH}
        crumb="Hakkımızda"
        eyebrow="Hakkımızda"
        title="Taşınmayı güvenli ve şeffaf hale getirmek için buradayız"
        lead="evdenevenakliyat.app, Türkiye'nin 81 ilinde taşınacak kişileri belgeleri doğrulanmış nakliyat firmalarıyla buluşturan bağımsız bir platformdur. Amacımız, taşınma kararını tahmine değil, doğrulanmış bilgiye ve gerçek müşteri deneyimine dayandırmak."
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Neden varız?" title="Taşınma, belirsizlikle başlamamalı" />
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Evden eve nakliyat, insanların en değerli eşyalarını birkaç saatliğine tanımadıkları bir ekibe emanet
              ettiği bir hizmet. Buna rağmen doğru firmayı bulmak çoğu zaman şu adımlardan geçiyor:
            </p>
          </div>
          <ul className="grid content-center gap-3">
            {PROBLEMS.map((item) => (
              <li key={item}>
                <Card className="p-5 text-zinc-700 dark:text-zinc-300">{item}</Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-zinc-50 py-20 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            align="center"
            eyebrow="Nasıl çalışıyoruz?"
            title="Dört ilke"
            description="Platformdaki her özellik bu ilkelerden birine hizmet eder."
          />
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Card className="h-full p-7">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Icon />
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">{text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Rolümüz" title="Biz bir nakliyat firması değiliz" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Taşıma hizmetini, teklifini kabul ettiğin nakliyat firması verir; ödemeyi de onunla anlaştığın şekilde
              ona yaparsın. Bizim işimiz, doğru firmayı bulman için gereken bilgiyi güvenilir ve karşılaştırılabilir
              şekilde önüne koymak, firmaların belgelerini denetlemek ve taşınma sonrasında deneyimini kayıt altına
              almak.
            </p>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Bunun yanında il ve ilçe sayfalarımızda bölgeye özel fiyat etkenlerini ve taşınma rehberlerini
              yayımlıyoruz. Hedefimiz, Türkiye&apos;de evden eve nakliyat denince başvurulan tarafsız bilgi kaynağı
              olmak.
            </p>
          </div>
          <Card className="self-start p-7">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Bize ulaş</h2>
            <ul className="mt-4 space-y-3 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent-700" />
                <span>
                  Soru, öneri ve şikâyetler:{" "}
                  <a href={`mailto:${COMPANY.supportEmail}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                    {COMPANY.supportEmail}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent-700" />
                <span>
                  Kişisel veri başvuruları:{" "}
                  <a href={`mailto:${COMPANY.kvkkEmail}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                    {COMPANY.kvkkEmail}
                  </a>
                </span>
              </li>
              {COMPANY_INFO_READY && (
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent-700" />
                  <span>
                    İşleten: {COMPANY.title} (şahıs işletmesi), {COMPANY.address}
                  </span>
                </li>
              )}
            </ul>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-brand-900 p-8 text-white sm:p-12 dark:bg-brand-950">
          <div>
            <h2 className="text-2xl font-bold">Taşınmaya hazırlanıyor musun?</h2>
            <p className="mt-2 text-brand-100">
              Talebini oluştur, doğrulanmış firmalardan ücretsiz teklif al ya da{" "}
              <Link href={HUB_PATH} className="font-semibold text-white underline">
                ilini seçerek
              </Link>{" "}
              bölgendeki bilgilere göz at.
            </p>
          </div>
          <ButtonLink href="/talep-olustur" size="lg" variant="inverse">
            Ücretsiz teklif al <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
