import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/credits/copy-button";
import { Badge } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { INDEXNOW_KEY_PATH } from "@/lib/indexnow";
import type { SearchVerification } from "@/lib/site-settings";
import { SITE_URL } from "@/lib/site";
import { PageHeader } from "../admin-bits";
import { IndexNowButton } from "../sayfalar/indexnow-button";
import { VerificationForm } from "./verification-form";

export const metadata: Metadata = { title: { absolute: "Arama motorları | Yönetim" } };

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const ext = "font-medium text-brand-700 hover:underline";
const SITE = `${SITE_URL}/`;
const SITEMAP = `${SITE_URL}/sitemap.xml`;
/** Search Console bağlantıları URL ön eki mülkünü açar */
const GSC_RESOURCE = encodeURIComponent(SITE);

function Status({ code }: { code: string | null }) {
  return code ? <Badge tone="success">Kod eklendi</Badge> : <Badge>Kod yok</Badge>;
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">{children}</ol>;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ext}>
      {children} ↗
    </a>
  );
}

/**
 * Google Search Console, Bing ve Yandex bağlantısı: doğrulama kodları (ana sayfaya meta etiketi), site haritası,
 * Google’da adres denetimi ve Bing/Yandex’e IndexNow bildirimi tek ekranda.
 */
export default async function AdminSearchEnginesPage() {
  const { token } = await getAdminContext();
  const { verification, updatedAt } = await apiFetch<{ verification: SearchVerification; updatedAt: string | null }>(
    "/admin/site-settings",
    { token },
  );
  return (
    <>
      <PageHeader
        title="Arama motorları"
        description={
          <>
            Siteyi Google Search Console, Bing ve Yandex’e bağla, site haritasını gönder ve sayfaları dizine bildir.
            {updatedAt && ` Kodlarda son değişiklik: ${formatDateTime(updatedAt)}.`}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-5">
          <section className={card} aria-labelledby="google">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="google" className="text-lg font-semibold text-slate-900">1. Google Search Console</h2>
              <Status code={verification.google} />
            </div>
            <Steps>
              <li>
                <ExternalLink href="https://search.google.com/search-console/welcome">Search Console’u aç</ExternalLink>,
                “URL ön eki” kutusuna <code className="rounded bg-slate-100 px-1">{SITE}</code> yaz.
              </li>
              <li>Doğrulama yöntemlerinden “HTML etiketi”ni seç, verilen etiketi kopyala.</li>
              <li>Sağdaki “Google Search Console kodu” alanına yapıştırıp kaydet, sonra Search Console’da “Doğrula”ya bas.</li>
              <li>
                Doğrulanınca <ExternalLink href={`https://search.google.com/search-console/sitemaps?resource_id=${GSC_RESOURCE}`}>Site haritaları</ExternalLink>{" "}
                bölümüne <code className="rounded bg-slate-100 px-1">sitemap.xml</code> yazıp gönder. Bir kez yeterli; Google yeni sayfaları haritadan kendisi bulur.
              </li>
            </Steps>
            <p className="mt-3 text-xs text-slate-500">
              Alternatif: “Alan adı” mülkü seçersen doğrulama, alan adı firmasının DNS ayarlarına TXT kaydı eklenerek yapılır; burada kod gerekmez.
            </p>

            <form
              action="https://search.google.com/search-console/inspect"
              method="get"
              target="_blank"
              className="mt-5 border-t border-slate-200 pt-4"
            >
              <input type="hidden" name="resource_id" value={SITE} />
              <label className="block text-sm font-medium text-slate-800" htmlFor="inspect-url">
                Tek bir sayfayı Google’a hızlıca göster
              </label>
              <p className="text-xs text-slate-500">
                Search Console’da adres denetimi açılır; orada “Dizine eklenmesini iste”ye bas. Günde birkaç önemli sayfa için kullan.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="inspect-url"
                  name="id"
                  type="url"
                  required
                  defaultValue={`${SITE_URL}/evden-eve-nakliyat`}
                  className="block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Google’da denetle ↗
                </button>
              </div>
            </form>
          </section>

          <section className={card} aria-labelledby="bing">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="bing" className="text-lg font-semibold text-slate-900">2. Bing Webmaster Tools</h2>
              <Status code={verification.bing} />
            </div>
            <p className="mt-1 text-sm text-slate-600">ChatGPT ve Copilot aramaları Bing dizinini kullanır.</p>
            <Steps>
              <li>
                <ExternalLink href="https://www.bing.com/webmasters/">Bing Webmaster’ı aç</ExternalLink> ve Google hesabınla gir.
              </li>
              <li>
                En kolayı “Google Search Console’dan içe aktar”: site, doğrulama ve site haritası birlikte gelir (önce 1. adım bitmiş olmalı).
              </li>
              <li>Elle eklersen “HTML Meta Etiketi” yöntemindeki kodu sağdaki Bing alanına yapıştırıp kaydet, sonra “Doğrula”ya bas.</li>
              <li>
                Sayfalar kaydedildikçe Bing’e kendiliğinden bildirilir (IndexNow). İlk kurulumda ya da toplu değişiklikten sonra aşağıdaki düğmeyi kullan.
              </li>
            </Steps>
            <div className="mt-4 flex justify-start">
              <IndexNowButton />
            </div>
          </section>

          <section className={card} aria-labelledby="yandex">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="yandex" className="text-lg font-semibold text-slate-900">3. Yandex Webmaster (isteğe bağlı)</h2>
              <Status code={verification.yandex} />
            </div>
            <Steps>
              <li>
                <ExternalLink href="https://webmaster.yandex.com/sites/add/">Yandex Webmaster’da siteyi ekle</ExternalLink>, “Meta etiketi” yöntemini seç.
              </li>
              <li>Kodu sağdaki Yandex alanına yapıştırıp kaydet, sonra “Kontrol et”e bas. IndexNow bildirimleri Yandex’e de gider.</li>
            </Steps>
          </section>
        </div>

        <div className="space-y-5">
          <section className={card} aria-labelledby="kodlar">
            <h2 id="kodlar" className="mb-3 text-lg font-semibold text-slate-900">Doğrulama kodları</h2>
            <VerificationForm verification={verification} />
          </section>

          <section className={card} aria-labelledby="harita">
            <h2 id="harita" className="text-lg font-semibold text-slate-900">Site haritası</h2>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-sm">{SITEMAP}</code>
              <CopyButton value={SITEMAP} label="Site haritası adresini" />
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <Link href="/sitemap.xml" target="_blank" className={ext}>
                  Site haritasını gör ↗
                </Link>
              </li>
              <li>
                <Link href="/robots.txt" target="_blank" className={ext}>
                  robots.txt ↗
                </Link>{" "}
                <span className="text-slate-500">(site haritasını arama motorlarına zaten gösteriyor)</span>
              </li>
              <li>
                <Link href={INDEXNOW_KEY_PATH} target="_blank" className={ext}>
                  IndexNow anahtar dosyası ↗
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
