"use client";

import { Field, FormError, Input } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { changePassword, updateName, type AccountFormState } from "@/lib/actions/account";

const button =
  "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70";

function Saved({ show, children }: { show?: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p role="status" className="text-sm font-medium text-green-800">
      {children}
    </p>
  );
}

export function NameForm({ fullName }: { fullName: string }) {
  const { state, pending, invalid, formProps } = useFormAction<AccountFormState>(updateName, {});
  return (
    // Kaydedilen ad (boşlukları toplanmış hâliyle) kutuya yeniden yazılsın
    <form {...formProps} key={fullName} className="space-y-3">
      <Field label="Ad soyad" hint="Firmalar teklif ve mesajlarda bu adı görür; yorumlarında yalnızca adın ve soyadının baş harfi yazar.">
        <Input name="fullName" defaultValue={fullName} autoComplete="name" required minLength={3} maxLength={100} />
      </Field>
      <FormError message={state.error ?? invalid} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Kaydediliyor…" : "Adı kaydet"}
        </button>
        <Saved show={state.saved && !pending}>Adın kaydedildi.</Saved>
      </div>
    </form>
  );
}

export function PasswordForm({ changed }: { changed: boolean }) {
  const { state, pending, invalid, formProps } = useFormAction<AccountFormState>(changePassword, {});
  return (
    <form {...formProps} className="space-y-3">
      <Field label="Şu anki şifren">
        <Input type="password" name="currentPassword" autoComplete="current-password" required maxLength={72} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Yeni şifre" hint="En az 8 karakter.">
          <Input type="password" name="newPassword" autoComplete="new-password" required minLength={8} maxLength={72} />
        </Field>
        <Field label="Yeni şifre (tekrar)">
          <Input type="password" name="newPasswordAgain" autoComplete="new-password" required minLength={8} maxLength={72} />
        </Field>
      </div>
      <FormError message={state.error ?? invalid} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Değiştiriliyor…" : "Şifreyi değiştir"}
        </button>
        <Saved show={changed && !state.error && !pending}>Şifren değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.</Saved>
      </div>
    </form>
  );
}
