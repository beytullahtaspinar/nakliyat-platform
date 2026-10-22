import type { Instrumentation } from "next";

// Sunucuda oluşan her hata (sayfa, Server Action, route handler, proxy) buradan raporlanır.
// Kullanıcıya gösterilen hata kodu (digest) ile log satırı eşleşir.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Tarayıcı botları sayfalara uydurma Server Action isteği (POST + Next-Action/RSC başlığı) atıyor;
  // Next.js bunu "Expected RSC response" InvariantError'u ile 500'e çeviriyor. Uygulama hatası
  // değil, Sentry'ye gönderilmez; yalnızca tek satırlık uyarı logu kalır.
  if (isBogusRscPost(error, request.method)) {
    console.warn(
      JSON.stringify({ level: "warn", service: "web", message: "Geçersiz RSC isteği", method: request.method, path: request.path }),
    );
    return;
  }
  const { errorReporter } = await import("@/lib/monitoring");
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  errorReporter.capture(error, {
    method: request.method,
    path: request.path,
    tags: {
      digest,
      routeType: context.routeType,
      routePath: context.routePath,
      renderSource: "renderSource" in context ? context.renderSource : undefined,
    },
  });
  await errorReporter.flush();
};

function isBogusRscPost(error: unknown, method: string) {
  return (
    method === "POST" &&
    error instanceof Error &&
    error.name === "InvariantError" &&
    error.message.includes("Expected RSC response")
  );
}
