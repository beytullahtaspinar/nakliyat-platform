"use client";

import { Checkbox, Field, FormError, Input } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { deleteAccount, type DeleteAccountState } from "@/lib/actions/account";

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const { state, pending, invalid, formProps } = useFormAction<DeleteAccountState>(deleteAccount, {});
  return (
    <form {...formProps} className="space-y-4">
      {hasPassword && (
        <Field label="Şifren" hint="Hesabın sana ait olduğunu doğrulamak için.">
          <Input type="password" name="password" autoComplete="current-password" required maxLength={72} />
        </Field>
      )}
      <Checkbox name="onay" required label="Hesabımın ve kişisel verilerimin kalıcı olarak silineceğini anladım." />
      <FormError message={state.error ?? invalid} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-red-700 px-5 py-3 font-medium text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
      </button>
    </form>
  );
}
