"use client";

import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { impersonateCompany } from "@/lib/actions/admin";

/** Firma panelini firmanın gözünden açar (şifre gerekmez, geçiş kayda yazılır). */
export function ImpersonateButton({ companyId }: { companyId: string }) {
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
            const result = await impersonateCompany(companyId);
            setError(result?.error);
          })
        }
      >
        {pending ? "Açılıyor…" : "Firma paneline geç"}
      </Button>
      <FormError message={error} />
    </div>
  );
}
