"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-errors";

// Sayfa içinde beklenmeyen bir hata olduğunda gösterilir; üst menü ve alt bilgi yerinde kalır.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Sunucu hataları (digest taşır) sunucuda zaten raporlandı; burada yalnızca tarayıcı hataları
    if (!error.digest) reportClientError(error, "boundary");
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Bir sorun oluştu</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Bu sayfa şu an açılamadı</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Hata kaydedildi ve ekibimize iletildi. Birkaç saniye sonra tekrar deneyebilirsin. Girdiğin bilgiler
        kaybolmadıysa işlemine kaldığın yerden devam edebilirsin.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          Tekrar dene
        </Button>
        <ButtonLink href="/" variant="secondary">
          Ana sayfaya dön
        </ButtonLink>
      </div>
      {error.digest && (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Destek ekibine iletmek için hata kodu: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </main>
  );
}
