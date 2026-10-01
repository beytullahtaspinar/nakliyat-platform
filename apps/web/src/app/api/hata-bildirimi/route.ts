import { errorReporter } from "@/lib/monitoring";

const MAX_BODY_BYTES = 10_000;
const PER_IP_PER_MINUTE = 10;
const hits = new Map<string, { count: number; start: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > 60_000) {
    hits.set(ip, { count: 1, start: now });
    return true;
  }
  return ++entry.count <= PER_IP_PER_MINUTE;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Tarayıcı hatalarını alır (bkz. lib/client-errors.ts). Kötüye kullanıma karşı boyut ve hız sınırlı. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "yerel";
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES || !allowed(ip)) return new Response(null, { status: 204 });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const error = new Error(str(data.message, 1000) ?? "Tarayıcı hatası");
  error.name = str(data.type, 100) || "Error";
  error.stack = str(data.stack, 6000) ?? `${error.name}: ${error.message}`;

  errorReporter.capture(error, {
    path: str(data.path, 300),
    tags: {
      kaynak: "tarayici",
      source: str(data.source, 20),
      digest: str(data.digest, 50),
      userAgent: request.headers.get("user-agent")?.slice(0, 200),
    },
  });
  await errorReporter.flush();
  return new Response(null, { status: 204 });
}
