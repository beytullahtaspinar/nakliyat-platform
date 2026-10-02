import { Checkbox } from "@/components/forms/fields";

/** Metin yeni sekmede açılır ki yarım kalan form kaybolmasın */
function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="font-medium text-brand-700 underline">
      {children}
    </a>
  );
}

/**
 * Kayıt formlarındaki yasal onaylar.
 * - Zorunlu: kullanım koşullarının kabulü ve aydınlatma metninin okunduğu (aydınlatma bir rıza değildir, ayrı tutulur).
 * - İsteğe bağlı: ticari elektronik ileti için açık rıza. İşaretlenmemesi kaydı engellemez.
 * Sunucu tarafı consentPayload (lib/legal.ts) ile API'ye gönderir.
 */
export function ConsentFields() {
  return (
    <div className="space-y-3">
      <Checkbox
        name="kvkk"
        required
        label={
          <>
            <DocLink href="/kullanim-kosullari">Kullanım koşullarını</DocLink> kabul ediyorum,{" "}
            <DocLink href="/kvkk-aydinlatma-metni">KVKK aydınlatma metnini</DocLink> okudum.
          </>
        }
      />
      <Checkbox
        name="marketingConsent"
        label={
          <>
            Kampanya ve duyurulardan haberdar olmak istiyorum (isteğe bağlı,{" "}
            <DocLink href="/acik-riza-metni">açık rıza metni</DocLink>).
          </>
        }
      />
    </div>
  );
}

