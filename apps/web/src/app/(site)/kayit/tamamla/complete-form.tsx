"use client";

import { Field, FormError, Input, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { ConsentFields } from "@/components/legal/consent-fields";
import { completeOAuthSignup } from "@/lib/actions/oauth";

export function CompleteForm({ role, next, fullName }: { role: "CUSTOMER" | "COMPANY"; next?: string; fullName: string }) {
  const { state, pending, formProps } = useFormAction(completeOAuthSignup, {});
  const isCompany = role === "COMPANY";
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={isCompany ? "Yetkili adı soyadı" : "Ad soyad"}>
        <Input name="fullName" autoComplete="name" minLength={3} maxLength={100} defaultValue={fullName} required />
      </Field>
      <Field label="Cep telefonu" hint="Firmalar ve müşteriler seninle bu numaradan iletişime geçer.">
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
      </Field>
      <ConsentFields />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Kaydı tamamla</SubmitButton>
    </form>
  );
}
