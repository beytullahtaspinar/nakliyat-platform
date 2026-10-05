"use client";

import Link from "next/link";
import { useState } from "react";
import { CodeInput, useSecondsUntil } from "@/components/forms/code-input";
import { Field, FormError, Input, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { passwordResetStep, type PasswordResetState } from "@/lib/actions/password-reset";

const linkClass = "font-medium text-blue-700 hover:underline";

/**
 * İki adım: e-posta → kod + yeni şifre. Kod 15 dakika geçerli ve tek kullanımlık; kullanıldıktan
 * ya da süresi dolduktan sonra yeni kod istenir. Şifre değişince tüm oturumlar kapanır.
 */
export function PasswordResetForm() {
  const { state, pending, formProps } = useFormAction<PasswordResetState>(passwordResetStep, {});
  const [changing, setChanging] = useState(false);
  const [lastSent, setLastSent] = useState<string>();
  // Yeni bir gönderim olunca "adresi değiştir" görünümünden çıkılır
  if (state.sentTo && state.resendAt !== lastSent) {
    setLastSent(state.resendAt);
    setChanging(false);
  }

  if (!state.sentTo || changing) {
    return (
      <>
        <p className="mt-2 text-sm text-zinc-600">
          Hesabındaki e-posta adresini yaz, şifreni yenilemen için 6 haneli bir kod gönderelim.
        </p>
        <form {...formProps} className="mt-8 space-y-4">
          <input type="hidden" name="intent" value="send" />
          <Field label="E-posta">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.sentTo}
              maxLength={191}
              required
              autoFocus
            />
          </Field>
          <FormError message={state.error} />
          <SubmitButton pending={pending}>Kod gönder</SubmitButton>
          <p className="text-sm text-zinc-600">
            Hesabında e-posta adresi yoksa{" "}
            <a href="mailto:destek@evdenevenakliyat.app" className={linkClass}>
              destek@evdenevenakliyat.app
            </a>{" "}
            adresine telefon numaranla yaz.
          </p>
          <p className="text-center text-sm text-zinc-600">
            Şifreni hatırladın mı?{" "}
            <Link href="/giris" className={linkClass}>
              Giriş yap
            </Link>
          </p>
        </form>
      </>
    );
  }

  return <CodeStep state={state} pending={pending} formProps={formProps} onChange={() => setChanging(true)} />;
}

function CodeStep({
  state,
  pending,
  formProps,
  onChange,
}: {
  state: PasswordResetState;
  pending: boolean;
  formProps: ReturnType<typeof useFormAction<PasswordResetState>>["formProps"];
  onChange: () => void;
}) {
  const [code, setCode] = useState("");
  const wait = useSecondsUntil(state.resendAt ?? null);
  return (
    <>
      <p role="status" className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
        <strong>{state.sentTo}</strong> bir hesaba kayıtlıysa şifre sıfırlama kodunu gönderdik. Gelen kutunu ve spam klasörünü
        kontrol et.
      </p>
      <form {...formProps} className="mt-6 space-y-4">
        <input type="hidden" name="intent" value="reset" />
        <input type="hidden" name="email" value={state.sentTo} />
        <input type="hidden" name="resendAt" value={state.resendAt ?? ""} />
        <CodeInput
          value={code}
          onChange={setCode}
          disabled={pending}
          label="E-postadaki kod"
          hint="Kod 15 dakika geçerlidir ve bir kez kullanılır."
        />
        <Field label="Yeni şifre (en az 8 karakter)">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </Field>
        <Field label="Yeni şifre (tekrar)">
          <Input name="passwordAgain" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </Field>
        <FormError message={state.error} />
        <SubmitButton pending={pending}>Şifremi değiştir</SubmitButton>
      </form>
      <form {...formProps} className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="email" value={state.sentTo} />
        <button
          type="submit"
          disabled={pending || wait > 0}
          suppressHydrationWarning
          className="text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline"
        >
          {wait > 0 ? `Yeni kod (${wait} sn)` : "Yeni kod gönder"}
        </button>
        <button type="button" onClick={onChange} className="text-sm font-medium text-brand-700 hover:underline">
          Adresi değiştir
        </button>
      </form>
    </>
  );
}
