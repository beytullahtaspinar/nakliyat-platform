"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { attachDocument, prepareDocumentUpload } from "@/lib/actions/company-documents";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, type DocumentType } from "@/lib/company-documents";
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

/** Tek belge yükleme: dosya seç, (K3 için) geçerlilik tarihini gir, yükle */
export function DocumentUpload({
  type,
  dated,
  label,
}: {
  type: DocumentType;
  dated?: boolean;
  /** Düğme yazısı: "Yükle" ya da "Yenisini yükle" */
  label: string;
}) {
  const router = useRouter();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const choose = (picked: File | null) => {
    setError(undefined);
    if (!picked) return setFile(null);
    if (!DOCUMENT_MIME_TYPES.includes(mimeOf(picked))) {
      setError("Belge PDF, JPG, PNG ya da WebP olmalı.");
      return setFile(null);
    }
    if (picked.size > DOCUMENT_MAX_BYTES) {
      setError("Dosya 10 MB'tan büyük. PDF'i sıkıştır ya da belgenin fotoğrafını çekip yükle.");
      return setFile(null);
    }
    setFile(picked);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Önce dosyayı seç.");
    if (dated && !validUntil) return setError("Belgenin geçerlilik bitiş tarihini gir.");
    setError(undefined);
    setProgress(0);
    const ticket = await prepareDocumentUpload(mimeOf(file), file.size);
    if (!ticket.ok) {
      setProgress(null);
      return setError(ticket.error);
    }
    try {
      await putFile(ticket.data, file, setProgress);
    } catch {
      setProgress(null);
      return setError("Yüklenemedi, bağlantını kontrol edip tekrar dene.");
    }
    const saved = await attachDocument({
      type,
      key: ticket.data.key,
      fileName: file.name,
      ...(dated && { validUntil }),
    });
    setProgress(null);
    if (!saved.ok) return setError(saved.error);
    setFile(null);
    setValidUntil("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  const busy = progress !== null;
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-56" htmlFor={`${id}-file`}>
          <span className="text-sm font-medium text-zinc-800">Dosya (PDF, JPG, PNG; en fazla 10 MB)</span>
          <input
            ref={fileRef}
            id={`${id}-file`}
            type="file"
            accept={DOCUMENT_ACCEPT}
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
          />
        </label>
        {dated && (
          <label className="basis-44" htmlFor={`${id}-date`}>
            <span className="text-sm font-medium text-zinc-800">Geçerlilik bitişi</span>
            <input
              id={`${id}-date`}
              type="date"
              min={today()}
              value={validUntil}
              disabled={busy}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <Button type="submit" size="sm" disabled={busy || !file}>
          {busy ? `Yükleniyor… %${Math.round((progress ?? 0) * 100)}` : label}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
