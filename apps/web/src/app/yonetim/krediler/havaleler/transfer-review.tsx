"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { approveTransfer, rejectTransfer, type AdminActionState } from "@/lib/actions/admin";
import { creditsForAmount, formatCredits, formatTryExact, parseTryAmount } from "@/lib/credits";

const dialogClass =
  "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40";

const toInput = (amount: string) => Number(amount).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/**
 * Bekleyen havale bildirimi: onay (hesaba geçen tutar düzeltilebilir) ya da gerekçeli ret.
 * Pencerede (dialog) sorulur; işlem bitince pencere kapanır, liste sunucudan yenilenir.
 */
export function TransferReview({
  transferId,
  companyName,
  amountTry,
  creditValueTry,
}: {
  transferId: string;
  companyName: string;
  amountTry: string;
  creditValueTry: number;
}) {
  const approveDialog = useRef<HTMLDialogElement>(null);
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const approveTitle = useId();
  const rejectTitle = useId();
  const [amount, setAmount] = useState(toInput(amountTry));
  const approve = useFormAction(approveTransfer.bind(null, transferId), {} as AdminActionState);
  const reject = useFormAction(rejectTransfer.bind(null, transferId), {} as AdminActionState);

  useEffect(() => {
    if (approve.state.notice) approveDialog.current?.close();
  }, [approve.state]);
  useEffect(() => {
    if (reject.state.notice) rejectDialog.current?.close();
  }, [reject.state]);

  const value = parseTryAmount(amount);
  const credits = Number.isFinite(value) ? creditsForAmount(value, creditValueTry) : 0;
  const differs = Number.isFinite(value) && value !== Number(amountTry);

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => approveDialog.current?.showModal()} aria-haspopup="dialog">
        Onayla
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => rejectDialog.current?.showModal()} aria-haspopup="dialog">
        Reddet
      </Button>

      <dialog ref={approveDialog} aria-labelledby={approveTitle} className={dialogClass}>
        <form {...approve.formProps} className="space-y-4 p-5">
          <div>
            <h2 id={approveTitle} className="text-lg font-semibold text-slate-900">
              Havaleyi onayla
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {companyName} · bildirilen {formatTryExact(amountTry)}
            </p>
          </div>
          <Field label="Hesaba geçen tutar (TL)" hint="Banka hesabında gördüğün tutar. Farklıysa düzelt; kredi bu tutara göre yüklenir.">
            <input name="amountTry" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </Field>
          <p aria-live="polite" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {credits > 0 ? (
              <>
                Firmaya <strong className="text-slate-900">{formatCredits(credits)}</strong> yüklenecek (1 kredi {creditValueTry.toLocaleString("tr-TR")} TL).
                {differs && " Tutar bildirilenden farklı."}
              </>
            ) : (
              "Tutar en az 1 kredi etmeli."
            )}
          </p>
          <FormError message={approve.state.error ?? approve.invalid} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => approveDialog.current?.close()} disabled={approve.pending}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={approve.pending || credits < 1}>
              {approve.pending ? "İşleniyor…" : "Onayla ve krediyi yükle"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={rejectDialog} aria-labelledby={rejectTitle} className={dialogClass}>
        <form {...reject.formProps} className="space-y-4 p-5">
          <div>
            <h2 id={rejectTitle} className="text-lg font-semibold text-slate-900">
              Havale bildirimini reddet
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {companyName} · {formatTryExact(amountTry)}
            </p>
          </div>
          <Field label="Gerekçe" hint="Firma panelinde ve bildirimde görür. Ör. hesabımıza bu tutarda havale gelmedi.">
            <textarea name="reason" required minLength={3} maxLength={500} rows={3} className={inputClass} />
          </Field>
          <FormError message={reject.state.error ?? reject.invalid} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => rejectDialog.current?.close()} disabled={reject.pending}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={reject.pending}>
              {reject.pending ? "İşleniyor…" : "Reddet"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
