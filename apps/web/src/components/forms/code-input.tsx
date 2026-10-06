"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/** Rakam dışını atar, 6 haneye kısaltır ("513 001" ya da "Kodun: 513001" yapıştırılsa da) */
export const toCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

/**
 * Tek alanlı 6 haneli kod girişi: telefonun klavye önerisi (one-time-code), yapıştırma ve ekran
 * okuyucu için kutu kutu alanlardan daha sorunsuz. E-postada bağlantı yok (başka tarayıcıda açılıp
 * oturumsuz kalıyordu): kullanıcı kodu kopyalar, "Kodu yapıştır" düğmesi panodaki kodu alana yazar.
 */
export function CodeInput({
  value,
  onChange,
  disabled,
  label = "Doğrulama kodu",
  hint = "Kod 10 dakika geçerlidir.",
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const canPaste = useCanReadClipboard();
  const [pasteError, setPasteError] = useState<string>();

  const paste = async () => {
    setPasteError(undefined);
    try {
      const digits = (await navigator.clipboard.readText()).replace(/\D/g, "");
      if (digits.length === 6) onChange(digits);
      else setPasteError("Panoda 6 haneli kod bulunamadı. E-postadaki kodu kopyalayıp tekrar dene.");
    } catch {
      setPasteError("Panoya erişilemedi. Kodu alana basılı tutup yapıştırabilirsin.");
    }
  };

  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        <input
          name="code"
          value={value}
          onChange={(e) => onChange(toCode(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          // maxLength yok: boşluklu ya da tireli yapıştırılan kod ("513 001") önce kesilip hane kaybediyordu;
          // rakam dışı karakterler toCode() içinde atılır ve 6 haneye kısaltılır
          required
          autoFocus={autoFocus}
          placeholder="______"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-center font-mono text-3xl tracking-[0.5em] text-zinc-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">{hint}</span>
        {canPaste && (
          <Button type="button" variant="secondary" size="sm" onClick={paste} disabled={disabled}>
            Kodu yapıştır
          </Button>
        )}
      </div>
      {pasteError && (
        <p role="status" className="mt-2 text-sm text-zinc-700">
          {pasteError}
        </p>
      )}
    </div>
  );
}

const noSubscribe = () => () => undefined;

/** Pano okuma her tarayıcıda yok (eski Firefox, http): düğme yalnızca destek varsa görünür */
function useCanReadClipboard() {
  return useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.clipboard?.readText === "function",
    () => false,
  );
}

/** Verilen ana kadar kalan saniye; "Yeni kod (42 sn)" sayacı için */
export function useSecondsUntil(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  const until = iso ? new Date(iso).getTime() : 0;
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
