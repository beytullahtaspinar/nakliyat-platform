"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { prepareReceiptUpload, reportTransfer } from "@/lib/actions/credits";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES } from "@/lib/company-documents";
import { creditsForAmount, formatCredits, formatIban, parseTryAmount, type BankAccount } from "@/lib/credits";
import { putFile } from "@/lib/media/upload";

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Bazı cihazlar dosya türünü boş bildirir: uzantıdan bulunur */
const mimeOf = (file: File) => file.type || BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

/** "Havale yaptım" bildirimi: tutar, gönderen, tarih, gönderilen hesap ve isteğe bağlı dekont */
export function TransferForm({
  accounts,
  minTopupTry,
  creditValueTry,
  defaultSender,
}: {
  accounts: BankAccount[];
  minTopupTry: number;
  creditValueTry: number;
  defaultSender: string;
}) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const value = parseTryAmount(amount);
  const credits = Number.isFinite(value) ? creditsForAmount(value, creditValueTry) : 0;

  const choose = (picked: File | null) => {
    setError(undefined);
    if (!picked) return setFile(null);
    if (!DOCUMENT_MIME_TYPES.includes(mimeOf(picked))) {
      setError("Dekont PDF, JPG, PNG ya da WebP olmalı.");
      return setFile(null);
    }
    if (picked.size > DOCUMENT_MAX_BYTES) {
      setError("Dosya 10 MB'tan büyük. Dekontun ekran görüntüsünü yükleyebilirsin.");
      return setFile(null);
    }
    setFile(picked);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice(undefined);
    const data = new FormData(e.currentTarget);
    if (!Number.isFinite(value) || value <= 0) return setError("Tutarı yaz (ör. 1500 ya da 1.500,50).");
    if (value < minTopupTry) return setError(`En az ${minTopupTry.toLocaleString("tr-TR")} TL yükleyebilirsin.`);
    setError(undefined);
    setProgress(0);

    let receipt: { key: string; fileName: string } | undefined;
    if (file) {
      const ticket = await prepareReceiptUpload(mimeOf(file), file.size);
      if (!ticket.ok) {
        setProgress(null);
        return setError(ticket.error);
      }
      try {
        await putFile(ticket.data, file, setProgress);
      } catch {
        setProgress(null);
        return setError("Dekont yüklenemedi, bağlantını kontrol edip tekrar dene.");
      }
      receipt = { key: ticket.data.key, fileName: file.name };
    }

    const saved = await reportTransfer({
      amountTry: value,
      senderName: String(data.get("senderName") ?? ""),
      transferDate: String(data.get("transferDate") ?? ""),
      iban: String(data.get("iban") ?? ""),
      note: String(data.get("note") ?? "").trim() || undefined,
      receipt,
    });
    setProgress(null);
    if (!saved.ok) return setError(saved.error);
    formRef.current?.reset();
    setAmount("");
    setFile(null);
    setNotice("Bildirimin alındı. Ödeme hesabımıza geçince krediyi yükleyip sana haber vereceğiz.");
    router.refresh();
  };

  const busy = progress !== null;
  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gönderdiğin tutar (TL)" hint={`En az ${minTopupTry.toLocaleString("tr-TR")} TL`}>
          <input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(undefined);
            }}
            aria-describedby={`${id}-credits`}
            className={inputClass}
          />
        </Field>
        <div id={`${id}-credits`} aria-live="polite" className="self-end rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {credits > 0 ? (
            <>
              Onaylanınca <strong className="text-slate-900">{formatCredits(credits)}</strong> yüklenir.
            </>
          ) : (
            `1 kredi ${creditValueTry.toLocaleString("tr-TR")} TL.`
          )}
        </div>
        <Field label="Gönderen adı ya da unvanı" hint="Dekontta yazdığı gibi">
          <input name="senderName" required minLength={2} maxLength={120} defaultValue={defaultSender} className={inputClass} />
        </Field>
        <Field label="Havale tarihi">
          <input name="transferDate" type="date" required max={today()} defaultValue={today()} className={inputClass} />
        </Field>
        {accounts.length > 1 ? (
          <Field label="Gönderdiğin hesap" className="sm:col-span-2">
            <select name="iban" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Hesap seç
              </option>
              {accounts.map((a) => (
                <option key={a.iban} value={a.iban}>
                  {a.bank} · {formatIban(a.iban)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="iban" value={accounts[0]?.iban ?? ""} />
        )}
        <label className="block min-w-0 sm:col-span-2" htmlFor={`${id}-file`}>
          <span className="text-sm font-medium text-zinc-800">Dekont (isteğe bağlı; PDF, JPG, PNG, en fazla 10 MB)</span>
          <input
            id={`${id}-file`}
            type="file"
            accept={DOCUMENT_ACCEPT}
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
          />
          <span className="mt-1 block text-xs text-zinc-500">Dekont eklersen onay daha hızlı olur.</span>
        </label>
        <Field label="Not (isteğe bağlı)" className="sm:col-span-2">
          <input name="note" maxLength={500} className={inputClass} />
        </Field>
      </div>
      <FormError message={error} />
      {notice && (
        <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          {notice}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? (file && progress! < 1 ? `Dekont yükleniyor… %${Math.round((progress ?? 0) * 100)}` : "Gönderiliyor…") : "Havale bildirimini gönder"}
      </Button>
    </form>
  );
}
