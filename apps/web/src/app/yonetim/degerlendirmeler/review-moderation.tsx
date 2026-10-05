"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { hideReview, showReview, type ReviewActionState } from "@/lib/actions/reviews";

/**
 * Satır içi işlem: yorumu gerekçeyle gizleme ya da yeniden yayına alma. Onay ve gerekçe pencerede
 * (dialog) sorulur; tablo satırı genişlemez. İşlem bitince pencere kapanır, liste sunucudan yenilenir.
 */
export function ReviewModeration({ reviewId, isPublished, label }: { reviewId: string; isPublished: boolean; label: string }) {
  // label: pencerede hangi yorumun işlendiğini söyler (firma · müşteri)
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const action = isPublished ? hideReview.bind(null, reviewId) : () => showReview(reviewId);
  const [state, formAction, pending] = useActionState<ReviewActionState, FormData>(action, {});

  useEffect(() => {
    if (state.notice) dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      >
        {isPublished ? "Gizle" : "Yayına al"}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40"
      >
        <form action={formAction} className="space-y-4 p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {isPublished ? "Yorumu gizle" : "Yorumu yeniden yayına al"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
          {isPublished ? (
            <Field
              label="Gizleme gerekçesi"
              hint="Firma ve müşteri kendi panelinde görür. Ör. hakaret, kişisel bilgi, reklam, işle ilgisiz içerik."
            >
              <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={inputClass} />
            </Field>
          ) : (
            <p className="text-sm text-slate-700">Yorum firma sayfasına ve puan ortalamasına geri dönecek.</p>
          )}
          <FormError message={state.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => dialog.current?.close()} disabled={pending}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "İşleniyor…" : isPublished ? "Yorumu gizle" : "Evet, yayına al"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
