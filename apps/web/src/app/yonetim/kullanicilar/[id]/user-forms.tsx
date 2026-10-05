"use client";

import { useState, useTransition } from "react";
import { Field, FormError, Input, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { deleteUser, setUserPassword, updateUser, type AdminActionState } from "@/lib/actions/admin";
import type { AdminUser } from "@/lib/api";
import { generatePassword } from "../../account-fields";
import { formatPhone } from "@/lib/format";

function Notice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
      {message}
    </p>
  );
}

export function UserForm({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { state, pending, formProps } = useFormAction(updateUser.bind(null, user.id), {} as AdminActionState);
  return (
    <form {...formProps} className="space-y-4">
      <Field label="Ad soyad">
        <Input name="fullName" defaultValue={user.fullName} minLength={2} maxLength={100} required />
      </Field>
      <Field label="Cep telefonu" hint="Giriş bu numarayla yapılır. Değişirse numara doğrulanmamış sayılır.">
        <Input name="phone" type="tel" inputMode="tel" defaultValue={formatPhone(user.phone)} required />
      </Field>
      <Field label="E-posta" hint="Boş bırakılırsa silinir.">
        <Input name="email" type="email" defaultValue={user.email ?? ""} maxLength={200} />
      </Field>
      <Field label="Hesap durumu" hint={isSelf ? "Kendi hesabını askıya alamazsın." : "Askıya alınan hesap giriş yapamaz, açık oturumları kapanır."}>
        <select name="status" defaultValue={user.status} disabled={isSelf} className={inputClass}>
          <option value="ACTIVE">Aktif</option>
          <option value="SUSPENDED">Askıya alınmış</option>
        </select>
      </Field>
      {isSelf && <input type="hidden" name="status" value={user.status} />}
      <FormError message={state.error} />
      <Notice message={state.notice} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}

export function PasswordForm({ userId }: { userId: string }) {
  const { state, pending, formProps } = useFormAction(setUserPassword.bind(null, userId), {} as AdminActionState);
  const [password, setPassword] = useState("");
  return (
    <form {...formProps} className="space-y-3">
      <Field label="Yeni şifre" hint="En az 8 karakter. Şifreyi kullanıcıya telefonla veya yüz yüze ilet.">
        <input
          name="password"
          type="text"
          autoComplete="off"
          spellCheck={false}
          minLength={8}
          maxLength={72}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </Field>
      <FormError message={state.error} />
      <Notice message={state.notice} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setPassword(generatePassword())}>
          Şifre oluştur
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Şifreyi değiştir"}
        </Button>
      </div>
    </form>
  );
}

/** İki adımlı silme: yanlışlıkla tek tıkla hesap silinmesin. */
export function DeleteUserForm({ userId, name }: { userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="secondary" className="text-red-700" onClick={() => setConfirming(true)}>
        Hesabı sil
      </Button>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-red-800">
        {name} hesabı kalıcı olarak silinecek. Bu işlem geri alınamaz.
      </p>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-red-700 hover:bg-red-800"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteUser(userId);
              setError(result?.error);
            })
          }
        >
          {pending ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
