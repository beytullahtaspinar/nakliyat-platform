"use client";

import { useActionState, useId, useRef } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { reportContent, type ReportActionState } from "@/lib/actions/reports";

const REASONS = [
  { value: "ABUSE", label: "Hakaret ya da taciz" },
  { value: "INAPPROPRIATE", label: "Uygunsuz içerik" },
  { value: "FRAUD", label: "Dolandırıcılık şüphesi" },
  { value: "SPAM", label: "İstenmeyen ya da reklam" },
  { value: "OTHER", label: "Diğer" },
] as const;

/**
 * Mesaj, yorum ya da firma yanıtını yönetime bildirme bağlantısı ve penceresi. Mobil uygulamalardaki
 * "Bildir" ile aynı uca gider; bildirim /yonetim/sikayetler ekranına düşer.
 */
export function ReportButton({
  target,
  targetId,
  className = "text-zinc-600",
}: {
  target: "MESSAGE" | "REVIEW" | "REVIEW_REPLY";
  targetId: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(reportContent.bind(null, target, targetId), {});

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className={`text-xs underline-offset-2 hover:underline ${className}`}
      >
        Bildir
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-left text-zinc-900 shadow-xl backdrop:bg-zinc-900/40"
      >
        {state.notice ? (
          <div className="space-y-4 p-5">
            <h2 id={titleId} className="text-lg font-semibold">
              Bildirimin alındı
            </h2>
            <p className="text-sm text-zinc-700">
              Ekibimiz en geç 24 saat içinde inceler. Kurallara aykırıysa içerik kaldırılır, gerekirse hesap kapatılır.
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => dialog.current?.close()}>
                Tamam
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4 p-5">
            <h2 id={titleId} className="text-lg font-semibold">
              Neden bildiriyorsun?
            </h2>
            <fieldset className="space-y-2">
              <legend className="sr-only">Neden</legend>
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
                >
                  <input type="radio" name="reason" value={r.value} required />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <Field label="Açıklama (isteğe bağlı)">
              <textarea name="note" maxLength={500} rows={2} className={inputClass} />
            </Field>
            <FormError message={state.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => dialog.current?.close()} disabled={pending}>
                Vazgeç
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Gönderiliyor…" : "Bildir"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
