import { APP_RELEASE } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/** Çalışma izleme ve deploy sonrası kontrol için: web uygulaması ayakta mı, hangi sürüm kurulu? */
export function GET() {
  return Response.json(
    { status: "ok", release: APP_RELEASE ?? "yerel" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
