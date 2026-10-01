import type { Instrumentation } from "next";

// Sunucuda oluşan her hata (sayfa, Server Action, route handler, proxy) buradan raporlanır.
// Kullanıcıya gösterilen hata kodu (digest) ile log satırı eşleşir.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
