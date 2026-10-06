"use client";

import Link from "next/link";
import { Field, FormError, Input, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { login } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useFormAction(login, {});
  return (
    <form {...formProps} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Cep telefonu">
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
      </Field>
      <Field label="Şifre">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <p className="-mt-2 text-right text-sm">
        <Link href="/sifre-sifirla" className="font-medium text-blue-700 hover:underline">
          Şifremi unuttum
        </Link>
      </p>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Giriş yap</SubmitButton>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Hesabın yok mu?{" "}
        <Link href={next ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit"} className="font-medium text-blue-700 hover:underline">
          Kayıt ol
        </Link>
      </p>
    </form>
  );
}
