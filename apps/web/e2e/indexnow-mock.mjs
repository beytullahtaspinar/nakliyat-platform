/**
 * Testler için sahte IndexNow. Web sunucusu INDEXNOW_ENDPOINT ile buraya bildirir; test GET /alinan ile
 * gelen istekleri okur. POST /siradaki?kod=403 bir sonraki toplu bildirime (10'dan fazla adres) o kodla yanıt verdirir;
 * tek sayfa kaydı bildirimleri etkilenmez, paralel testler birbirini bozmaz.
 *
 * Çalıştırma: node e2e/indexnow-mock.mjs (varsayılan port 4300, INDEXNOW_MOCK_PORT ile değişir)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.INDEXNOW_MOCK_PORT ?? 4300);
/** Gelen istek gövdeleri (en yenisi sonda) */
const received = [];
/** Bir sonraki toplu bildirime verilecek hata kodu */
let nextStatus = null;

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.method === "POST" && url.pathname === "/siradaki") {
      nextStatus = Number(url.searchParams.get("kod"));
      res.writeHead(204);
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/indexnow") {
      const body = JSON.parse(raw);
      if (nextStatus && body.urlList.length > 10) {
        res.writeHead(nextStatus);
        nextStatus = null;
        return res.end("Forbidden");
      }
      received.push(body);
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
