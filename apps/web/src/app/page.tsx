import Link from "next/link";
import { citySlug, getCities } from "@nakliyat/locations";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge, Card, SectionHeading } from "@/components/ui/card";
import {
  ArrowRightIcon,
  CheckIcon,
  CompareIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  TruckIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { HUB_PATH } from "@/lib/local-content";
import { LAUNCH_CITIES } from "@/lib/local-seo";

const selectClass =
  "mt-1.5 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 " +
  "focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15 " +
  "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const BENEFITS = [
  {
    icon: ShieldCheckIcon,
    title: "Doğrulanmış firmalar",
    text: "Teklif veren her firmanın K3 yetki belgesi ve firma bilgileri incelenir.",
  },
  {
    icon: WalletIcon,
    title: "Ücretsiz, bağlayıcı değil",
    text: "Teklif almak ücretsizdir. Beğenmezsen hiçbirini kabul etmek zorunda değilsin.",
  },
  {
    icon: CompareIcon,
    title: "Tek ekranda karşılaştır",
    text: "Fiyatı, hizmet kapsamını ve firma puanını yan yana gör, kararını kolay ver.",
  },
  {
    icon: MapPinIcon,
    title: "81 ilde hizmet",
    text: "İl içi, ilçe arası ya da şehirler arası; Türkiye'nin her yerinden talep oluştur.",
  },
];

const STEPS = [
  {
    title: "Talebini oluştur",
    text: "Nereden, nereye, ev tipi, kat ve tarih bilgilerini bir kez gir. İki dakika sürer.",
  },
  {
    title: "Teklifler gelsin",
    text: "Bölgende hizmet veren doğrulanmış firmalar talebine özel fiyat teklifi gönderir.",
  },
  {
    title: "Karşılaştır ve seç",
    text: "Teklifleri fiyat, kapsam ve puana göre karşılaştır, sana uyanı tek tıkla kabul et.",
  },
];

const VERIFICATION = [
  "K3 yetki belgesi kontrolü",
  "Vergi ve firma bilgisi doğrulaması",
  "Yalnızca işi tamamlanan müşterilerden puan",
  "Teklif fiyat geçmişinin kaydı",
];

export default function Home() {
  const cities = getCities();

  return (
    <main className="flex-1">
      {/* Karşılama */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white dark:from-brand-950/60 dark:to-zinc-950">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_28rem_at_90%_-10%,var(--color-brand-200),transparent_70%)] opacity-60 dark:bg-[radial-gradient(40rem_28rem_at_90%_-10%,var(--color-brand-800),transparent_70%)] dark:opacity-40"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <Badge tone="brand">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> K3 belgeli, doğrulanmış firmalar
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] text-zinc-900 sm:text-5xl lg:text-[3.4rem] dark:text-white">
              Taşınmanı <span className="text-brand-700 dark:text-brand-300">güvenle</span> planla,
              teklifleri tek yerden karşılaştır
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-300">
              Taşınma bilgilerini bir kez gir. Türkiye genelinde doğrulanmış nakliyat firmaları sana
              teklif göndersin; fiyatı, kapsamı ve puanı yan yana görüp en uygununu seç.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {["Ücretsiz", "Bağlayıcı değil", "81 ilde"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon className="h-4 w-4 text-accent-700" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <Card className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Ücretsiz teklif al</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Nereden nereye taşınacağını seç, devamını birlikte dolduralım.
            </p>
            <form action="/talep-olustur" method="get" className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nereden</span>
                <select name="nereden" className={selectClass} defaultValue="" required>
                  <option value="" disabled>
                    İl seç
                  </option>
                  {cities.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nereye</span>
                <select name="nereye" className={selectClass} defaultValue="" required>
                  <option value="" disabled>
                    İl seç
                  </option>
                  {cities.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass({ size: "lg", className: "w-full" })}>
                Teklifleri görmeye başla <ArrowRightIcon className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-zinc-500">
              Teklif almak ücretsizdir ve seni hiçbir firmaya bağlamaz.
            </p>
          </Card>
        </div>
      </section>

      {/* Faydalar */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Nasıl çalışır */}
      <section id="nasil-calisir" className="scroll-mt-20 bg-zinc-50 py-20 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            align="center"
            eyebrow="Nasıl çalışır?"
            title="Üç adımda doğru nakliyat firması"
            description="Tek tek firma aramak, aynı bilgileri defalarca anlatmak yok."
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
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
          <div className="mt-10 text-center">
            <ButtonLink href="/talep-olustur" size="lg">
              Hemen talep oluştur <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Doğrulama */}
      <section className="bg-brand-900 text-white dark:bg-brand-950">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">Güven önce gelir</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Eşyalarını kime emanet ettiğini bil</h2>
            <p className="mt-4 text-lg text-brand-100">
              Platformda teklif veren her nakliyat firması yayına alınmadan önce incelenir. Puanlar
              yalnızca o firmayla gerçekten taşınan müşterilerden gelir.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {VERIFICATION.map((item) => (
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

      {/* İller */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Türkiye geneli"
            title="Popüler illerde evden eve nakliyat"
            description="İl ve ilçe sayfalarında bölgeye özel fiyat etkenlerini ve teklif verilerini bul."
          />
          <Link
            href={HUB_PATH}
            className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            81 ilin tamamı <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {LAUNCH_CITIES.map((city) => (
            <li key={city.code}>
              <Link
                href={`/${citySlug(city)}`}
                className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700"
              >
                <span>
                  <span className="block font-display text-lg font-bold text-zinc-900 dark:text-white">
                    {city.name}
                  </span>
                  <span className="text-sm text-zinc-500">Evden eve nakliyat</span>
                </span>
                <ArrowRightIcon className="h-5 w-5 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Firmalar için */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-accent-50 to-accent-100 p-8 sm:p-12 md:grid-cols-[auto_1fr_auto] dark:from-accent-950 dark:to-zinc-900">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-400 text-brand-950">
            <TruckIcon className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Nakliyat firması mısın?</h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              Bölgendeki gerçek taşınma taleplerine teklif ver, iyi hizmetini puanlarla görünür kıl.
            </p>
          </div>
          <ButtonLink href="/kayit?rol=firma" variant="secondary">
            <StarIcon className="h-5 w-5 text-accent-700" /> Firma olarak katıl
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
