"use client";

import { useActionState } from "react";
import { Field, FormError, Input } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { saveSearchVerification, type SiteSettingsActionState } from "@/lib/actions/site-settings";
import type { SearchVerification } from "@/lib/site-settings";

const FIELDS = [
  {
    name: "google",
    label: "Google Search Console kodu",
    hint: "HTML etiketi yöntemindeki content=\"…\" değeri. Etiketin tamamını yapıştırsan da olur.",
  },
  { name: "bing", label: "Bing Webmaster kodu (msvalidate.01)", hint: "Google'dan içe aktardıysan gerekmez." },
  { name: "yandex", label: "Yandex Webmaster kodu", hint: "İsteğe bağlı." },
] as const;

/** Doğrulama kodları: kaydedilince ana sayfaya meta etiketi olarak eklenir; boş bırakılan kaldırılır */
export function VerificationForm({ verification }: { verification: SearchVerification }) {
  const [state, formAction, pending] = useActionState<SiteSettingsActionState, FormData>(saveSearchVerification, {});
  return (
    <form action={formAction} className="space-y-4">
      {FIELDS.map((f) => (
        <Field key={f.name} label={f.label} hint={f.hint}>
          <Input name={f.name} defaultValue={state.values?.[f.name] ?? verification[f.name] ?? ""} autoComplete="off" spellCheck={false} maxLength={300} />
        </Field>
      ))}
      <FormError message={state.error} />
      {state.notice && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {state.notice}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kodları kaydet"}
      </Button>
    </form>
  );
}
