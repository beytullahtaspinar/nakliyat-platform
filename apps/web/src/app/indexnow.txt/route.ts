import { INDEXNOW_KEY } from "@/lib/indexnow";

/** IndexNow anahtar dosyası: arama motorları bildirimin bu siteden geldiğini buradan doğrular */
export const dynamic = "force-static";

export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
