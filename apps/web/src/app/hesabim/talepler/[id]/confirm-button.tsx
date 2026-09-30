"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/forms/fields";
import type { RequestFormState } from "@/lib/actions/requests";

type Props = {
  action: () => Promise<RequestFormState>;
  label: string;
  confirmText: string;
  confirmLabel: string;
  variant?: "primary" | "quiet";
};

/** İki adımlı onay: geri alınamayan işlemler (teklif kabulü, iptal) yanlışlıkla yapılmasın. */
export function ConfirmButton({ action, label, confirmText, confirmLabel, variant = "primary" }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [asking, setAsking] = useState(false);

  const primary =
    "rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-70";
  const quiet =
    "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={variant === "primary" ? primary : quiet}>
        {label}
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className="text-sm">{confirmText}</p>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "İşleniyor…" : confirmLabel}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className={quiet}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
