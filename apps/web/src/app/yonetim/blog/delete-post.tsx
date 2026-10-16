"use client";

import { useId, useRef, useState, useTransition } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { deletePost } from "@/lib/actions/blog";

/** Yazıyı silme: onay penceresinde sorulur. Silinen yazının adresi 404 olur. */
export function DeletePost({ postId, title }: { postId: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        Yazıyı sil
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="space-y-4 p-5">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Yazı silinsin mi?
          </h2>
          <p className="text-sm text-slate-700">
            &quot;{title}&quot; kalıcı olarak silinir ve adresi açılmaz olur. Geçici olarak kaldırmak için &quot;Yayından kaldır&quot;ı kullan.
          </p>
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => dialog.current?.close()} disabled={pending}>
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await deletePost(postId);
                  if (result?.error) setError(result.error);
                })
              }
            >
              {pending ? "Siliniyor…" : "Evet, sil"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
