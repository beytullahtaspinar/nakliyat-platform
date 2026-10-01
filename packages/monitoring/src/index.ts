/**
 * Hata raporlama. Her hata iki yere gider:
 *  1. Sunucu loguna tek satır JSON olarak (her zaman). cPanel'deki stderr.log içinde
 *     olay kimliği veya istek kimliğiyle aranabilir.
 *  2. SENTRY_DSN verilmişse Sentry'ye (envelope API'si, ek paket olmadan).
 *
 * Sentry'nin resmi Node paketleri ~40-80 MB bağımlılık getiriyor; 2 GB diskli sunucuda
 * bunun yerine yalnızca hata olaylarını gönderen bu küçük istemciyi kullanıyoruz.
 * Kişisel veri (istek gövdesi, telefon, adres, çerez, başlık) hiçbir zaman gönderilmez.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

export type TagValue = string | number | boolean | undefined;

export type ErrorContext = {
  /** İstek kimliği (API'de X-Request-Id) */
  requestId?: string;
  method?: string;
  /** Yalnızca yol; sorgu dizesi otomatik atılır */
  path?: string;
  tags?: Record<string, TagValue>;
  extra?: Record<string, unknown>;
};

export type ReporterOptions = {
  /** Servis adı: "api", "web" */
  service: string;
  dsn?: string;
  release?: string;
  environment?: string;
  /** Hata fırtınasında Sentry kotasını korumak için dakikalık üst sınır (log'a yazma sınırsız) */
  maxEventsPerMinute?: number;
  fetch?: typeof fetch;
  log?: (line: string) => void;
  now?: () => number;
};

export type ErrorReporter = {
  /** Sentry gönderimi açık mı */
  readonly enabled: boolean;
  /** Hatayı loglar ve (açıksa) Sentry'ye gönderir. Olay kimliğini döner. */
  capture(error: unknown, context?: ErrorContext): string;
  /** Bekleyen gönderimleri bekler (kapanışta) */
  flush(timeoutMs?: number): Promise<void>;
};

export type StackFrame = {
  filename: string;
  function: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
};

type Dsn = { endpoint: string; publicKey: string; dsn: string };

const SDK_NAME = "nakliyat.monitoring";
const SDK_VERSION = "0.1.0";

export function parseDsn(dsn: string): Dsn | null {
  try {
    const url = new URL(dsn);
    const segments = url.pathname.split("/").filter(Boolean);
    const projectId = segments.pop();
    if (!url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = segments.length ? `/${segments.join("/")}` : "";
    return {
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
      publicKey: decodeURIComponent(url.username),
      dsn,
    };
  } catch {
    return null;
  }
}

// V8 (Node, Chrome):   "    at fn (file:10:5)"  |  "    at file:10:5"
// Firefox / Safari:    "fn@file:10:5"
const V8_LINE = /^\s*at (?:async )?(?:(.+?) \((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))\s*$/;
const GECKO_LINE = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

/** Yığın izini Sentry çerçevelerine çevirir (en eski çağrı başta, Sentry'nin beklediği sıra). */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n").slice(0, 100)) {
    let fn: string | undefined;
    let file: string | undefined;
    let ln: string | undefined;
    let col: string | undefined;
    const v8 = V8_LINE.exec(line);
    if (v8) {
      [fn, file, ln, col] = v8[2] ? [v8[1], v8[2], v8[3], v8[4]] : [undefined, v8[5], v8[6], v8[7]];
    } else {
      const gecko = GECKO_LINE.exec(line);
      if (!gecko) continue;
      [fn, file, ln, col] = [gecko[1], gecko[2], gecko[3], gecko[4]];
    }
    frames.push({
      filename: file,
      function: fn || "?",
      lineno: Number(ln),
      colno: Number(col),
      in_app: !file.includes("node_modules") && !file.startsWith("node:"),
    });
  }
  return frames.reverse();
}

function normalizeError(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name || "Error", message: error.message, stack: error.stack };
  }
  if (typeof error === "string") return { type: "Error", message: error };
  try {
    return { type: "NonError", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { type: "NonError", message: String(error) };
  }
}

function cleanTags(tags: Record<string, TagValue> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (value !== undefined) out[key] = String(value).slice(0, 200);
  }
  return out;
}

export function stripQuery(path: string | undefined): string | undefined {
  return path?.split("?")[0];
}

/** Sürüm etiketini (ör. "surum-12") okur: önce ortam değişkeni, sonra paketin RELEASE dosyası. */
export function readRelease(file: string | URL, envValue = process.env.APP_RELEASE): string | undefined {
  if (envValue) return envValue;
  try {
    return readFileSync(file, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function createErrorReporter(options: ReporterOptions): ErrorReporter {
  const dsn = options.dsn ? parseDsn(options.dsn) : null;
  const doFetch = options.fetch ?? globalThis.fetch;
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const now = options.now ?? Date.now;
  const limit = options.maxEventsPerMinute ?? 30;
  const pending = new Set<Promise<unknown>>();
  let windowStart = 0;
  let sentInWindow = 0;

  if (options.dsn && !dsn) {
    log(JSON.stringify({ level: "warn", service: options.service, message: "SENTRY_DSN geçersiz, Sentry kapalı" }));
  }

  function underLimit(): boolean {
    const t = now();
    if (t - windowStart >= 60_000) {
      windowStart = t;
      sentInWindow = 0;
    }
    return sentInWindow++ < limit;
  }

  function send(eventId: string, err: ReturnType<typeof normalizeError>, ctx: ErrorContext, timestamp: number) {
    if (!dsn || !doFetch || !underLimit()) return;
    const tags = cleanTags({ service: options.service, ...ctx.tags, requestId: ctx.requestId });
    const event = {
      event_id: eventId,
      timestamp: timestamp / 1000,
      platform: "node",
      level: "error",
      logger: options.service,
      release: options.release,
      environment: options.environment,
      tags,
      extra: ctx.extra,
      transaction: ctx.path ? `${ctx.method ?? ""} ${ctx.path}`.trim() : undefined,
      request: ctx.path ? { method: ctx.method, url: ctx.path } : undefined,
      exception: {
        values: [
          {
            type: err.type,
            value: err.message.slice(0, 8000),
            stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
          },
        ],
      },
      sdk: { name: SDK_NAME, version: SDK_VERSION },
    };
    const body =
      `${JSON.stringify({ event_id: eventId, sent_at: new Date(timestamp).toISOString(), dsn: dsn.dsn })}\n` +
      `${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
    const request = doFetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=${SDK_NAME}/${SDK_VERSION}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    })
      .catch((e: unknown) => {
        log(JSON.stringify({ level: "warn", service: options.service, message: "Sentry'ye gönderilemedi", detail: String(e) }));
      })
      .finally(() => pending.delete(request));
    pending.add(request);
  }

  return {
    enabled: Boolean(dsn),
    capture(error, context = {}) {
      const eventId = randomUUID().replace(/-/g, "");
      const timestamp = now();
      const err = normalizeError(error);
      const ctx = { ...context, path: stripQuery(context.path) };
      try {
        log(
          JSON.stringify({
            time: new Date(timestamp).toISOString(),
            level: "error",
            service: options.service,
            release: options.release,
            eventId,
            requestId: ctx.requestId,
            method: ctx.method,
            path: ctx.path,
            type: err.type,
            message: err.message,
            stack: err.stack,
            tags: ctx.tags && cleanTags(ctx.tags),
          }),
        );
        send(eventId, err, ctx, timestamp);
      } catch {
        // Hata raporlayıcı hiçbir durumda uygulamayı düşürmemeli
      }
      return eventId;
    },
    async flush(timeoutMs = 2000) {
      if (!pending.size) return;
      await Promise.race([
        Promise.allSettled([...pending]),
        new Promise((resolve) => setTimeout(resolve, timeoutMs).unref?.()),
      ]);
    },
  };
}
