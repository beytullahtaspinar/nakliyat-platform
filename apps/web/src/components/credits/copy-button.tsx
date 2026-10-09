"use client";

import { useState } from "react";

/** Metni panoya kopyalar (IBAN, havale kodu); kopyalandığını ekran okuyucuya da söyler */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim yoksa (eski tarayıcı, izin) metin zaten seçilebilir durumda
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} kopyala`}
      className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
    >
      <span aria-live="polite">{copied ? "Kopyalandı" : "Kopyala"}</span>
    </button>
  );
}
