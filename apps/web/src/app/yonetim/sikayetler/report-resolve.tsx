"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { resolveReport, type ReportActionState } from "@/lib/actions/reports";

const REMOVE_LABEL = { MESSAGE: "Mesajı sil", REVIEW: "Yorumu gizle", REVIEW_REPLY: "Firma yanıtını sil" } as const;

/** Şikayet kararı: içeriği kaldır, içerik kalsın ama haklı bul, ya da kural ihlali yok. Pencerede (dialog) sorulur. */
export function ReportResolve({ reportId, target, label }: { reportId: string; target: keyof typeof REMOVE_LABEL; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(resolveReport.bind(null, reportId), {});

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
              Şikayete karar ver
            </h2>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="sr-only">Karar</legend>
            {[
              { value: "remove", title: REMOVE_LABEL[target], hint: "Kural dışı: içerik kaldırılır." },
              { value: "keep", title: "Haklı, içerik kalsın", hint: "Ör. kullanıcıyı uyardın ya da hesabını sildin." },
              { value: "dismiss", title: "Kural ihlali yok", hint: "Şikayet reddedilir, içerik olduğu gibi kalır." },
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
          <Field label="Not" hint="Yorum gizlenirse firma ve müşteri bu gerekçeyi görür.">
            <textarea name="resolution" maxLength={500} rows={2} className={inputClass} />
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
