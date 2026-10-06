"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";

/**
 * useActionState + form. React, eylem bitince formu varsayılan değerlerine sıfırlar;
 * hata dönerse kullanıcının yazdıkları kaybolmasın diye gönderim elle yapılır.
 * JavaScript kapalıysa form yine normal şekilde çalışır.
 *
 * Tarayıcı eksik/hatalı bir alan yüzünden gönderimi durdurursa (ör. iPhone'da tarih sınır dışı,
 * onay kutusu işaretsiz) uyarı balonu sayfanın yukarısında kalıp görünmeyebiliyor; düğme
 * "çalışmıyor" sanılıyor. İlk hatalı alan ekranın ortasına kaydırılır ve `invalid` iletisi döner,
 * form bunu gönder düğmesinin yanında gösterebilir.
 */
export function useFormAction<S extends object>(
  action: (state: Awaited<S>, formData: FormData) => Promise<S>,
  initial: Awaited<S>,
) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [invalid, setInvalid] = useState<string>();
  const reported = useRef(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInvalid(undefined);
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  // invalid olayı kabarmaz, yakalama aşamasında dinlenir. Bir gönderimde yalnızca ilk alan bildirilir.
  const onInvalidCapture = (event: FormEvent<HTMLFormElement>) => {
    if (reported.current) return;
    reported.current = true;
    setTimeout(() => (reported.current = false), 0);
    const field = event.target as HTMLInputElement;
    const label = field.closest("label")?.querySelector("span")?.textContent?.trim();
    const reason = field.validationMessage || "Bu alanı kontrol et.";
    setInvalid(label ? `${label}: ${reason}` : reason);
    field.scrollIntoView?.({ block: "center", behavior: "smooth" });
  };

  return { state, pending, invalid, formProps: { action: formAction, onSubmit, onInvalidCapture } };
}
