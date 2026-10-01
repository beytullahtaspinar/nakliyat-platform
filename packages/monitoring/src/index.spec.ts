import { describe, expect, it, vi } from "vitest";
import { createErrorReporter, parseDsn, parseStack, stripQuery } from "./index.js";

describe("parseDsn", () => {
  it("Sentry DSN'inden envelope adresini üretir", () => {
    expect(parseDsn("https://abc123@o42.ingest.de.sentry.io/4507")).toEqual({
      endpoint: "https://o42.ingest.de.sentry.io/api/4507/envelope/",
      publicKey: "abc123",
      dsn: "https://abc123@o42.ingest.de.sentry.io/4507",
    });
  });

  it("alt yol içeren kendi barındırılan DSN'i destekler", () => {
    expect(parseDsn("https://key@sentry.example.com/yol/7")?.endpoint).toBe(
      "https://sentry.example.com/yol/api/7/envelope/",
    );
  });

  it("geçersiz DSN için null döner", () => {
    expect(parseDsn("bozuk")).toBeNull();
    expect(parseDsn("https://sentry.io/1")).toBeNull();
    expect(parseDsn("https://key@sentry.io/proje")).toBeNull();
  });
});

describe("parseStack", () => {
  it("V8 yığın izini en eski çağrı başta olacak şekilde çevirir", () => {
    const stack = [
      "Error: patladı",
      "    at RequestsService.create (/app/dist/requests/requests.service.js:42:11)",
      "    at async RequestsController.create (/app/dist/requests/requests.controller.js:20:5)",
      "    at /app/node_modules/@nestjs/core/router/router-execution-context.js:46:28",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames).toHaveLength(4);
    expect(frames[3]).toEqual({
      filename: "/app/dist/requests/requests.service.js",
      function: "RequestsService.create",
      lineno: 42,
      colno: 11,
      in_app: true,
    });
    expect(frames[1]).toMatchObject({ function: "?", in_app: false });
    expect(frames[0]).toMatchObject({ filename: "node:internal/process/task_queues", in_app: false });
  });

  it("Firefox/Safari biçimini de okur", () => {
    const frames = parseStack("onClick@https://site/_next/static/chunks/app.js:1:2345\n@https://site/x.js:3:4");
    expect(frames.map((f) => f.function)).toEqual(["?", "onClick"]);
    expect(frames[1]).toMatchObject({ lineno: 1, colno: 2345 });
  });
});

describe("stripQuery", () => {
  it("sorgu dizesini atar (kişisel veri sızmasın)", () => {
    expect(stripQuery("/requests?telefon=0555")).toBe("/requests");
  });
});

describe("createErrorReporter", () => {
  it("DSN yokken yalnızca JSON log yazar", () => {
    const lines: string[] = [];
    const fetch = vi.fn();
    const reporter = createErrorReporter({ service: "api", log: (l) => lines.push(l), fetch });
    const id = reporter.capture(new TypeError("x tanımsız"), { requestId: "r1", path: "/v1/a?b=c", method: "GET" });

    expect(reporter.enabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: "error",
      service: "api",
      eventId: id,
      requestId: "r1",
      path: "/v1/a",
      type: "TypeError",
      message: "x tanımsız",
    });
  });

  it("DSN varken Sentry'ye envelope gönderir", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    const reporter = createErrorReporter({
      service: "web",
      dsn: "https://pub@o1.ingest.sentry.io/9",
      release: "surum-12",
      environment: "production",
      log: () => {},
      fetch,
    });
    const id = reporter.capture(new Error("boom"), { tags: { routeType: "render", bos: undefined } });
    await reporter.flush();

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://o1.ingest.sentry.io/api/9/envelope/");
    expect(init.headers["X-Sentry-Auth"]).toContain("sentry_key=pub");
    const [header, item, payload] = init.body.trim().split("\n").map((l: string) => JSON.parse(l));
    expect(header.event_id).toBe(id);
    expect(item).toEqual({ type: "event" });
    expect(payload).toMatchObject({
      release: "surum-12",
      environment: "production",
      tags: { service: "web", routeType: "render" },
      exception: { values: [{ type: "Error", value: "boom" }] },
    });
    expect(payload.tags).not.toHaveProperty("bos");
  });

  it("dakikalık sınırı aşınca Sentry'ye göndermeyi keser ama loglamaya devam eder", () => {
    let t = 0;
    const lines: string[] = [];
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    const reporter = createErrorReporter({
      service: "api",
      dsn: "https://pub@o1.ingest.sentry.io/9",
      maxEventsPerMinute: 2,
      log: (l) => lines.push(l),
      fetch,
      now: () => t,
    });
    for (let i = 0; i < 5; i++) reporter.capture(new Error(`h${i}`));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lines).toHaveLength(5);

    t = 61_000;
    reporter.capture(new Error("yeni dakika"));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("Sentry'ye ulaşılamazsa uygulamayı etkilemez", async () => {
    const lines: string[] = [];
    const reporter = createErrorReporter({
      service: "api",
      dsn: "https://pub@o1.ingest.sentry.io/9",
      log: (l) => lines.push(l),
      fetch: vi.fn().mockRejectedValue(new Error("ağ yok")),
    });
    reporter.capture("düz metin hata");
    await reporter.flush();
    expect(lines.some((l) => l.includes("Sentry'ye gönderilemedi"))).toBe(true);
  });
});
