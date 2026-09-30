"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState + form. React, eylem bitince formu varsayılan değerlerine sıfırlar;
 * hata dönerse kullanıcının yazdıkları kaybolmasın diye gönderim elle yapılır.
 * JavaScript kapalıysa form yine normal şekilde çalışır.
 */
export function useFormAction<S extends object>(
  action: (state: Awaited<S>, formData: FormData) => Promise<S>,
  initial: Awaited<S>,
) {
  const [state, formAction, pending] = useActionState(action, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
  return { state, pending, formProps: { action: formAction, onSubmit } };
}
