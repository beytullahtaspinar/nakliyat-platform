/**
 * Testler için sahte IndexNow. Web sunucusu INDEXNOW_ENDPOINT ile buraya bildirir; test GET /alinan ile
 * gelen istekleri okur.
 *
 * Çalıştırma: node e2e/indexnow-mock.mjs (varsayılan port 4300, INDEXNOW_MOCK_PORT ile değişir)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.INDEXNOW_MOCK_PORT ?? 4300);
/** Gelen istek gövdeleri (en yenisi sonda) */
const received = [];

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.method === "POST" && url.pathname === "/indexnow") {
      received.push(JSON.parse(raw));
      if (received.length > 200) received.shift();
      res.writeHead(202);
      return res.end();
    }
    if (url.pathname === "/alinan" || url.pathname === "/saglik") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(url.pathname === "/saglik" ? { ok: true } : received));
    }
    res.writeHead(404);
    res.end();
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Sahte IndexNow: http://127.0.0.1:${PORT}`));
