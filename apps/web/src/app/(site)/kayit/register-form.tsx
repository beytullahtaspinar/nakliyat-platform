"use client";

import Link from "next/link";
import { Checkbox, Field, FormError, Input, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { register } from "@/lib/actions/auth";

export function RegisterForm({ role, next }: { role: "CUSTOMER" | "COMPANY"; next?: string }) {
  const { state, pending, formProps } = useFormAction(register, {});
  const isCompany = role === "COMPANY";
  const loginHref = next ? `/giris?next=${encodeURIComponent(next)}` : "/giris";
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={isCompany ? "Yetkili adı soyadı" : "Ad soyad"}>
        <Input name="fullName" autoComplete="name" minLength={3} maxLength={100} required />
      </Field>
      <Field label="Cep telefonu" hint="Giriş yaparken bu numarayı kullanacaksın.">
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
      </Field>
      <Field label="E-posta (isteğe bağlı)">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Şifre" hint="En az 8 karakter.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Checkbox
        name="kvkk"
        required
        label={
          isCompany
            ? "Firma bilgilerimin doğrulama ve teklif süreçleri için işlenmesini kabul ediyorum."
            : "Kişisel verilerimin, taleplerimin nakliyat firmalarına iletilmesi amacıyla işlenmesini kabul ediyorum."
        }
      />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>{isCompany ? "Firma hesabı oluştur" : "Kayıt ol"}</SubmitButton>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Zaten hesabın var mı?{" "}
        <Link href={loginHref} className="font-medium text-blue-700 hover:underline">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
