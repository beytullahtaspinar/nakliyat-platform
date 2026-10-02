"use client";

import { useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { submitReview, type ReviewActionState } from "@/lib/actions/reviews";
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH, RATING_LABELS } from "@/lib/reviews";

const STAR = "m12 3.8 2.5 5.1 5.6.8-4 4 1 5.5-5.1-2.7-5 2.7.9-5.5-4-4 5.6-.8L12 3.8Z";

/** Yıldızlarla puan seçimi: altta gerçek radyo düğmeleri (klavye ve ekran okuyucu için) */
function RatingInput() {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">Puanın</legend>
      <div className="mt-1 flex flex-wrap items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700"
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name="rating"
              value={n}
              required
              checked={value === n}
              onChange={() => setValue(n)}
              className="sr-only"
            />
            <svg
              viewBox="0 0 24 24"
              className={`h-10 w-10 ${n <= shown ? "text-accent-600" : "text-zinc-300"}`}
              fill="currentColor"
              aria-hidden
            >
              <path d={STAR} />
            </svg>
            <span className="sr-only">
              {n} yıldız, {RATING_LABELS[n]}
            </span>
          </label>
        ))}
        <span className="ml-2 min-w-16 text-sm font-medium text-zinc-700" aria-hidden>
          {shown ? RATING_LABELS[shown] : ""}
        </span>
      </div>
    </fieldset>
  );
}

/** Müşterinin tamamlanan iş için firmayı değerlendirdiği form */
export function ReviewForm({ bookingId, pagePath, companyName }: { bookingId: string; pagePath: string; companyName: string }) {
  const { state, pending, formProps } = useFormAction(submitReview.bind(null, bookingId, pagePath), {} as ReviewActionState);
  return (
    <form {...formProps} className="space-y-4">
      <RatingInput />
      <Field
        label={`${companyName} ile deneyimin (isteğe bağlı)`}
        hint={`Ekip zamanında geldi mi, eşyalarına özen gösterdi mi, fiyat konuşulduğu gibi miydi? En az ${COMMENT_MIN_LENGTH} karakter. Yorumun adının baş harfiyle (ör. "Ayşe Y.") firma sayfasında yayımlanır; telefon, adres gibi kişisel bilgi yazma.`}
      >
        <textarea name="comment" rows={4} maxLength={COMMENT_MAX_LENGTH} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      {state.notice && (
        <p role="status" className="text-sm font-medium text-green-800">
          {state.notice}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Değerlendirmeyi gönder"}
      </Button>
    </form>
  );
}
