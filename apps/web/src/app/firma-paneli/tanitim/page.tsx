import type { Metadata } from "next";
import { PageHeader } from "@/components/panel/panel-bits";
import Link from "next/link";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Badge, Card } from "@/components/ui/card";
import { removeShowcaseMedia } from "@/lib/actions/company-showcase";
import { apiFetch, type CompanyShowcase, type ShowcaseMedia } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { companyPath } from "@/lib/reviews";
import { CaptionForm } from "./caption-form";
import { ImageUpload } from "./image-upload";
import { ShowcaseForm } from "./showcase-form";

export const metadata: Metadata = { title: "Tanıtım sayfası" };

function HiddenNote({ media }: { media: ShowcaseMedia }) {
  if (!media.hidden) return null;
  return (
    <p className="text-xs text-red-800">
      Yönetim tarafından sayfadan kaldırıldı{media.hiddenReason ? `: ${media.hiddenReason}` : ""}. Silip yenisini ekleyebilirsin.
    </p>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className={done ? "text-green-700" : "text-zinc-400"}>
        {done ? "✓" : "○"}
      </span>
      <span>
        <span className="sr-only">{done ? "Tamam: " : "Eksik: "}</span>
        {children}
      </span>
    </li>
  );
}

export default async function CompanyShowcasePage() {
  const { profile, token } = await getCompanyContext();
  if (!profile) return null;
  const showcase = await apiFetch<CompanyShowcase>("/company/showcase", { token });
  const { indexing, limits } = showcase;
  const published = profile.verificationStatus === "VERIFIED";
  const remaining = limits.maxPhotos - showcase.photos.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tanıtım sayfası"
        description="Herkese açık firma sayfanın yazısı, logosu ve fotoğrafları."
        actions={
          published && (
            <Link href={companyPath(profile)} className="text-sm font-semibold text-brand-700 hover:underline">
              Sayfanı gör
            </Link>
          )
        }
      />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Tanıtım sayfan</h2>
          <Badge tone={published ? "success" : "warning"} className="ml-auto">
            {published ? "Yayında" : "Firma onaylanınca yayına girer"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          Müşteriler teklifini karşılaştırırken ve Google&apos;da firmanı ararken bu sayfayı görür. Yazdıkların ve
          eklediğin görseller hemen yayınlanır; kurallara aykırı içeriği yönetim kaldırabilir.
        </p>
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm">
          {indexing.hasReviews || indexing.complete ? (
            <p className="font-medium text-green-800">Sayfan Google&apos;da listelenebilir.</p>
          ) : (
            <>
              <p className="font-medium">Sayfanın Google&apos;da listelenmesi için (ya da ilk müşteri yorumunu aldığında):</p>
              <ul className="mt-2 space-y-1">
                <Check done={indexing.descriptionLength >= indexing.minDescription}>
                  En az {indexing.minDescription} karakter tanıtım yazısı (şu an {indexing.descriptionLength})
                </Check>
                <Check done={indexing.visiblePhotos >= indexing.minPhotos}>
                  En az {indexing.minPhotos} fotoğraf (şu an {indexing.visiblePhotos})
                </Check>
              </ul>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6" role="region" aria-label="Logo">
        <h2 className="text-lg font-semibold">Logo</h2>
        <p className="mt-1 text-sm text-zinc-600">Kare ya da yatay logo; sayfada ve tekliflerinde görünür.</p>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {showcase.logo && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi; zaten küçültülmüş */}
              <img
                src={showcase.logo.previewUrl}
                alt="Firma logosu"
                width={96}
                height={96}
                className="h-24 w-24 rounded-xl border border-zinc-200 bg-white object-contain p-1"
              />
              <HiddenNote media={showcase.logo} />
              <ConfirmButton
                action={removeShowcaseMedia.bind(null, showcase.logo.id)}
                label="Logoyu sil"
                confirmText="Logo sayfandan kaldırılacak."
                confirmLabel="Sil"
                variant="quiet"
              />
            </div>
          )}
          <div className="min-w-0 flex-1 basis-60">
            <ImageUpload kind="LOGO" label={showcase.logo ? "Yeni logo yükle" : "Logo yükle"} />
          </div>
        </div>
      </Card>

      <Card className="p-6" role="region" aria-label="Tanıtım bilgileri">
        <h2 className="mb-4 text-lg font-semibold">Tanıtım bilgileri</h2>
        <ShowcaseForm showcase={showcase} />
      </Card>

      <Card className="p-6" role="region" aria-label="Fotoğraflar">
        <h2 className="text-lg font-semibold">Araç, ekip ve depo fotoğrafları</h2>
        <p className="mt-1 text-sm text-zinc-600">
          En fazla {limits.maxPhotos} fotoğraf. Kendi araçların, ekibin ve iş başındaki fotoğraflar güven verir; başka
          firmaların ya da internetten alınmış görseller kaldırılır. Fotoğraflar küçültülür, konum bilgisi silinir.
        </p>
        {showcase.photos.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {showcase.photos.map((p) => (
              <li key={p.id} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli depo adresi; zaten küçültülmüş */}
                <img
                  src={p.previewUrl}
                  alt={p.caption ?? "Firma fotoğrafı"}
                  width={480}
                  height={360}
                  loading="lazy"
                  className={`aspect-[4/3] w-full rounded-lg bg-zinc-100 object-cover ${p.hidden ? "opacity-50" : ""}`}
                />
                <HiddenNote media={p} />
                <CaptionForm mediaId={p.id} caption={p.caption} max={limits.captionMax} />
                <ConfirmButton
                  action={removeShowcaseMedia.bind(null, p.id)}
                  label="Sil"
                  confirmText="Bu fotoğraf sayfandan silinecek."
                  confirmLabel="Sil"
                  variant="quiet"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5">
          {remaining > 0 ? (
            <ImageUpload kind="PHOTO" label="Fotoğraf ekle" remaining={remaining} />
          ) : (
            <p className="text-sm text-zinc-600">Fotoğraf sınırına ulaştın; yenisini eklemek için birini sil.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
