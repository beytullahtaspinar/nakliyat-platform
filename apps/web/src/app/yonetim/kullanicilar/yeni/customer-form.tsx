"use client";

import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { createCustomer, type AdminActionState } from "@/lib/actions/admin";
import { AccountFields } from "../../account-fields";

export function NewCustomerForm() {
  const { state, pending, formProps } = useFormAction(createCustomer, {} as AdminActionState);
  return (
    <form {...formProps} className="space-y-5">
      <AccountFields />
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Hesap açılıyor…" : "Müşteri hesabını aç"}
      </Button>
    </form>
  );
}
