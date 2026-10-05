"use client";

import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { impersonateCustomer } from "@/lib/actions/admin";

/** Müşteri hesabını müşterinin gözünden açar (şifre gerekmez, geçiş kayda yazılır). */
export function ImpersonateCustomerButton({ userId }: { userId: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await impersonateCustomer(userId);
            setError(result?.error);
          })
        }
      >
        {pending ? "Açılıyor…" : "Müşteri hesabına geç"}
      </Button>
      <FormError message={error} />
    </div>
  );
}
