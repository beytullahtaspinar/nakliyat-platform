"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { resolveDispute, type ReviewActionState } from "@/lib/actions/reviews";

/** İtiraz kararı: taşınma yapıldı (iş tamamlanır) ya da yapılmadı (iş iptal edilir). Pencerede (dialog) sorulur. */
export function DisputeResolve({ bookingId, label }: { bookingId: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<ReviewActionState, FormData>(resolveDispute.bind(null, bookingId), {});

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
        Karar ver
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40"
      >
        <form action={formAction} className="space-y-4 p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              İtiraza karar ver
            </h2>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="sr-only">Karar</legend>
            {[
              { value: "complete", title: "Taşınma yapıldı", hint: "İş tamamlanır, müşteri firmayı değerlendirebilir." },
              { value: "cancel", title: "Taşınma yapılmadı", hint: "İş ve talep iptal edilir. Firmanın kredisi kendiliğinden iade edilmez; gerekirse Krediler'den düzelt." },
            ].map((o, i) => (
              <label key={o.value} className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-brand-500 has-checked:bg-brand-50">
                <input type="radio" name="decision" value={o.value} defaultChecked={i === 0} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{o.title}</span>
                  <span className="block text-xs text-slate-600">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field label="Açıklama" hint="Müşteri ve firma bildirimde ve iş sayfasında bu metni görür.">
            <textarea name="note" required minLength={5} maxLength={500} rows={2} className={inputClass} />
          </Field>
          <FormError message={state.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => dialog.current?.close()} disabled={pending}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "İşleniyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
