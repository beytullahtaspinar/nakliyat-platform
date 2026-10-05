"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-errors";

// Kök düzen (layout) bile çizilemediğinde gösterilen son çare sayfası. Global CSS yüklenmediği
// için stiller satır içinde.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError(error, "boundary");
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "16px",
        }}
      >
        <title>Bir sorun oluştu | evdenevenakliyat.app</title>
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Bir sorun oluştu</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>
            Hata kaydedildi ve ekibimize iletildi. Lütfen birkaç saniye sonra tekrar dene.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 24,
              padding: "12px 24px",
              borderRadius: 12,
              border: 0,
              background: "#1e3a8a",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 14, color: "#64748b" }}>
              Hata kodu: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
