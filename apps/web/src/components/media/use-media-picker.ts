"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachMedia, prepareMediaUploads, type UploadTicket } from "@/lib/actions/media";
import { compressImage, compressVideo, MediaError, type Compressed } from "@/lib/media/compress";
import { MAX_PHOTOS, MAX_SOURCE_BYTES, MAX_VIDEOS, kindOf, type MediaKind } from "@/lib/media/rules";
import { putFile } from "@/lib/media/upload";

export type PickedItem = {
  id: string;
  kind: MediaKind;
  name: string;
  originalBytes: number;
  status: "processing" | "ready" | "uploading" | "done" | "error";
  /** Küçültme veya yükleme ilerlemesi, 0-1 */
  progress: number;
  result?: Compressed;
  previewUrl?: string;
  error?: string;
};

type Options = { existingPhotos?: number; existingVideos?: number };

let nextId = 0;

/**
 * Seçilen dosyaları sırayla küçültür (aynı anda tek dosya: telefonun belleği yorulmasın),
 * sonra küçültülmüş hallerini talebe yükler.
 */
export function useMediaPicker({ existingPhotos = 0, existingVideos = 0 }: Options = {}) {
  const [items, setItems] = useState<PickedItem[]>([]);
  const [notice, setNotice] = useState<string>();
  const queue = useRef(Promise.resolve());
  const aborts = useRef(new Map<string, AbortController>());
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const update = useCallback((id: string, patch: Partial<PickedItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // Sayfadan çıkınca önizleme adresleri ve süren küçültmeler bırakılır
  useEffect(() => {
    const running = aborts.current;
    return () => {
      running.forEach((c) => c.abort());
      itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    };
  }, []);

  const process = useCallback(
    (item: PickedItem, file: File) => {
      const controller = new AbortController();
      aborts.current.set(item.id, controller);
      queue.current = queue.current.then(async () => {
        if (controller.signal.aborted) return;
        try {
          const result =
            item.kind === "PHOTO"
              ? await compressImage(file)
              : await compressVideo(file, (progress) => update(item.id, { progress }), controller.signal);
          if (controller.signal.aborted) return;
          update(item.id, { status: "ready", progress: 1, result, previewUrl: URL.createObjectURL(result.blob) });
        } catch (err) {
          if (controller.signal.aborted) return;
          update(item.id, {
            status: "error",
            error: err instanceof MediaError ? err.message : "Dosya hazırlanamadı.",
          });
        } finally {
          aborts.current.delete(item.id);
        }
      });
    },
    [update],
  );

  const add = useCallback(
    (files: FileList | File[]) => {
      const current = itemsRef.current.filter((i) => i.status !== "error");
      let photos = existingPhotos + current.filter((i) => i.kind === "PHOTO").length;
      let videos = existingVideos + current.filter((i) => i.kind === "VIDEO").length;
      const skipped: string[] = [];
      const added: [PickedItem, File][] = [];

      for (const file of Array.from(files)) {
        const kind = kindOf(file);
        if (!kind) {
          skipped.push(`${file.name}: yalnızca fotoğraf ve video eklenebilir`);
        } else if (file.size > MAX_SOURCE_BYTES) {
          skipped.push(`${file.name}: dosya çok büyük`);
        } else if (kind === "PHOTO" && photos >= MAX_PHOTOS) {
          skipped.push(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir`);
        } else if (kind === "VIDEO" && videos >= MAX_VIDEOS) {
          skipped.push(`En fazla ${MAX_VIDEOS} video eklenebilir`);
        } else {
          if (kind === "PHOTO") photos++;
          else videos++;
          added.push([
            { id: `m${++nextId}`, kind, name: file.name, originalBytes: file.size, status: "processing", progress: 0 },
            file,
          ]);
        }
      }
      setNotice(skipped.length ? [...new Set(skipped)].join(". ") + "." : undefined);
      setItems((list) => [...list, ...added.map(([item]) => item)]);
      for (const [item, file] of added) process(item, file);
    },
    [existingPhotos, existingVideos, process],
  );

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.abort();
    setItems((list) => {
      const item = list.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return list.filter((i) => i.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setNotice(undefined);
  }, []);

  /** Hazır dosyaları talebe yükler; yüklenemeyen dosya sayısını döner. */
  const upload = useCallback(
    async (requestId: string): Promise<{ failed: number; error?: string }> => {
      const ready = itemsRef.current.filter((i) => (i.status === "ready" || i.status === "error") && i.result);
      if (!ready.length) return { failed: 0 };

      const tickets = await prepareMediaUploads(
        requestId,
        ready.map((i) => ({ mimeType: i.result!.mimeType, sizeBytes: i.result!.blob.size })),
      );
      if (!tickets.ok) return { failed: ready.length, error: tickets.error };

      const uploaded: { item: PickedItem; ticket: UploadTicket }[] = [];
      await runLimited(
        ready.map((item, index) => async () => {
          const ticket = tickets.data[index]!;
          update(item.id, { status: "uploading", progress: 0, error: undefined });
          try {
            await putFile(ticket, item.result!.blob, (progress) => update(item.id, { progress }));
            uploaded.push({ item, ticket });
          } catch {
            update(item.id, { status: "error", error: "Yüklenemedi, bağlantını kontrol edip tekrar dene." });
          }
        }),
        3,
      );
      if (!uploaded.length) return { failed: ready.length };

      const attached = await attachMedia(
        requestId,
        uploaded.map(({ item, ticket }) => ({
          key: ticket.key,
          width: item.result!.width,
          height: item.result!.height,
          ...(item.result!.durationSec !== undefined && { durationSec: item.result!.durationSec }),
        })),
      );
      if (!attached.ok) return { failed: ready.length, error: attached.error };
      for (const { item } of uploaded) update(item.id, { status: "done", progress: 1 });
      return { failed: ready.length - uploaded.length };
    },
    [update],
  );

  const processing = items.some((i) => i.status === "processing");
  const readyCount = items.filter((i) => i.status === "ready").length;
  return { items, notice, add, remove, clear, upload, processing, readyCount };
}

export type MediaPicker = ReturnType<typeof useMediaPicker>;

async function runLimited(tasks: (() => Promise<void>)[], limit: number) {
  const pending = [...tasks];
  await Promise.all(
    Array.from({ length: Math.min(limit, pending.length) }, async () => {
      while (pending.length) await pending.shift()!();
    }),
  );
}
