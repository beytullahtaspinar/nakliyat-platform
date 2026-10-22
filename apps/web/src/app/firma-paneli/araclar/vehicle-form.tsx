"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FormError, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { prepareVehicleUpload, saveVehicle, type VehicleInput } from "@/lib/actions/company-vehicles";
import type { CompanyVehicle, VehicleFileKind, VehicleType } from "@/lib/api";
import { compressImage, MediaError } from "@/lib/media/compress";
import { putFile } from "@/lib/media/upload";
import { VEHICLE_LABELS } from "@/lib/request-options";
import {
  AUTHORIZATIONS,
  PHOTO_ACCEPT,
  PLATE_PATTERN,
  REGISTRATION_ACCEPT,
  REGISTRATION_MAX_BYTES,
  VEHICLE_FILES,
  VEHICLE_PHOTO_MAX_BYTES,
  VEHICLE_PHOTO_SIDE,
  formatPlate,
  normalizePlate,
} from "@/lib/vehicles";

const VEHICLE_TYPES: VehicleType[] = ["KAMYON", "KAMYONET", "PANELVAN", "TIR"];
/** Ruhsat fotoğrafındaki yazılar okunsun diye araç fotoğraflarından büyük tutulur */
const REGISTRATION_PHOTO_SIDE = 2400;

const fileInputClass =
  "mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 " +
  "file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100";

type Picked = { file: File; preview: string | null };

/**
 * Araç ekleme ya da onaylanmamış aracı düzeltme. Fotoğraflar tarayıcıda küçültülür (konum bilgisi silinir),
 * ruhsat PDF ise olduğu gibi yüklenir. Dosyalar sırayla yüklenir, sonra araç tek seferde kaydedilir.
 */
export function VehicleForm({ vehicle, onDone }: { vehicle?: CompanyVehicle; onDone?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [plate, setPlate] = useState(vehicle ? formatPlate(vehicle.plate) : "");
  const [type, setType] = useState<VehicleType>(vehicle?.type ?? "KAMYON");
  const [authorization, setAuthorization] = useState<string>(vehicle?.authorization ?? "");
  const [picked, setPicked] = useState<Partial<Record<VehicleFileKind, Picked>>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  // Önizleme adresleri: değiştirilen dosyanınki hemen, kalanlar form kapanınca bırakılır
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const choose = (kind: VehicleFileKind, file: File | null) => {
    setError(undefined);
    const old = picked[kind]?.preview;
    if (old) {
      URL.revokeObjectURL(old);
      previews.current.delete(old);
    }
    const next = { ...picked };
    if (file) {
      const image = file.type.startsWith("image/") && !/hei[cf]/.test(file.type);
      const preview = image ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      next[kind] = { file, preview };
    } else delete next[kind];
    setPicked(next);
  };

  const uploadOne = async (kind: VehicleFileKind, file: File) => {
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (pdf && kind !== "REGISTRATION") throw new MediaError("Araç fotoğrafı PDF olamaz, fotoğraf seç.");
    let blob: Blob = file;
    let mimeType = "application/pdf";
    if (!pdf) {
      const compressed = await compressImage(file, kind === "REGISTRATION" ? REGISTRATION_PHOTO_SIDE : VEHICLE_PHOTO_SIDE);
      blob = compressed.blob;
      mimeType = compressed.mimeType;
    }
    const max = kind === "REGISTRATION" ? REGISTRATION_MAX_BYTES : VEHICLE_PHOTO_MAX_BYTES;
    if (blob.size > max) throw new MediaError(`Dosya çok büyük (en fazla ${max / 1024 / 1024} MB). PDF'i sıkıştırıp tekrar dene.`);
    const ticket = await prepareVehicleUpload(kind, mimeType, blob.size);
    if (!ticket.ok) throw new MediaError(ticket.error);
    await putFile(ticket.data, blob, () => {});
    return { key: ticket.data.key, fileName: file.name.slice(0, 200) || `${kind.toLowerCase()}` };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePlate(plate);
    if (!PLATE_PATTERN.test(normalized)) return setError("Plakayı ruhsattaki gibi yaz (ör. 34 ABC 123).");
    if (!authorization) return setError("Aracın kayıtlı olduğu yetki belgesini (K3 ya da L1) seç.");
    const missing = vehicle ? [] : VEHICLE_FILES.filter((f) => !picked[f.kind]);
    if (missing.length) return setError(`Eksik: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`);

    setError(undefined);
    const queue = VEHICLE_FILES.filter((f) => picked[f.kind]);
    const files: VehicleInput["files"] = {};
    try {
      for (const [index, spec] of queue.entries()) {
        setStatus(`Yükleniyor… ${index + 1}/${queue.length}`);
        files[spec.kind] = await uploadOne(spec.kind, picked[spec.kind]!.file);
      }
    } catch (err) {
      setStatus(null);
      return setError(err instanceof MediaError ? err.message : "Yüklenemedi, bağlantını kontrol edip tekrar dene.");
    }
    setStatus("Kaydediliyor…");
    const input: VehicleInput = vehicle
      ? {
          ...(normalized !== vehicle.plate && { plate: normalized }),
          ...(type !== vehicle.type && { type }),
          ...(authorization !== vehicle.authorization && { authorization }),
          ...(queue.length > 0 && { files }),
        }
      : { plate: normalized, type, authorization, files };
    const saved = await saveVehicle(vehicle?.id ?? null, input);
    setStatus(null);
    if (!saved.ok) return setError(saved.error);
    setPicked({});
    if (!vehicle) {
      setPlate("");
      setAuthorization("");
    }
    onDone?.();
    router.refresh();
  };

  const busy = status !== null;
  return (
    <form onSubmit={submit} className="space-y-4" aria-label={vehicle ? "Aracı düzelt" : "Araç ekle"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0" htmlFor={`${id}-plate`}>
          <span className="text-sm font-medium text-zinc-800">Plaka</span>
          <input
            id={`${id}-plate`}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="34 ABC 123"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={14}
            required
            disabled={busy}
            className={`${inputClass} font-mono tracking-wider`}
          />
          <span className="mt-1 block text-xs text-zinc-500">Ruhsatta yazdığı gibi.</span>
        </label>
        <label className="block min-w-0" htmlFor={`${id}-type`}>
          <span className="text-sm font-medium text-zinc-800">Araç tipi</span>
          <select
            id={`${id}-type`}
            value={type}
            onChange={(e) => setType(e.target.value as VehicleType)}
            disabled={busy}
            className={inputClass}
          >
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {VEHICLE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Aracın kayıtlı olduğu yetki belgesi</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {AUTHORIZATIONS.map((a) => (
            <label
              key={a.value}
              className="flex min-w-0 flex-1 basis-48 cursor-pointer items-start gap-2 rounded-lg border border-zinc-300 bg-white p-3 text-sm has-[:checked]:border-brand-700 has-[:checked]:ring-2 has-[:checked]:ring-brand-700/20"
            >
              <input
                type="radio"
                name={`${id}-authorization`}
                value={a.value}
                checked={authorization === a.value}
                onChange={() => setAuthorization(a.value)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 accent-brand-700"
              />
              <span>
                <span className="block font-semibold text-zinc-900">{a.label}</span>
                <span className="block text-zinc-600">{a.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {VEHICLE_FILES.map((spec) => {
          const current = vehicle?.files.find((f) => f.kind === spec.kind);
          const choice = picked[spec.kind];
          const preview = choice ? choice.preview : current?.mimeType.startsWith("image/") ? current.url : null;
          return (
            <div key={spec.kind} className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <label htmlFor={`${id}-${spec.kind}`} className="text-sm font-semibold text-zinc-900">
                {spec.label}
              </label>
              <p className="text-xs text-zinc-600">{spec.hint}</p>
              <div className="mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-white text-xs text-zinc-500 ring-1 ring-zinc-200">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme ya da imzalı, süreli depo adresi
                  <img src={preview} alt={`${spec.label} önizlemesi`} className="h-full w-full object-contain" />
                ) : choice || current ? (
                  <span className="px-2 text-center">{choice?.file.name ?? current?.fileName}</span>
                ) : (
                  <span>Seçilmedi</span>
                )}
              </div>
              <input
                id={`${id}-${spec.kind}`}
                type="file"
                accept={spec.kind === "REGISTRATION" ? `${REGISTRATION_ACCEPT},image/heic,image/heif` : PHOTO_ACCEPT}
                disabled={busy}
                onChange={(e) => choose(spec.kind, e.target.files?.[0] ?? null)}
                className={fileInputClass}
              />
              {current && !choice && <p className="mt-1 text-xs text-zinc-500">Değiştirmek için yeni dosya seç.</p>}
            </div>
          );
        })}
      </div>

      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {status ?? (vehicle ? "Düzeltmeyi gönder" : "Aracı ekle")}
        </Button>
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>
            Vazgeç
          </Button>
        )}
      </div>
    </form>
  );
}
