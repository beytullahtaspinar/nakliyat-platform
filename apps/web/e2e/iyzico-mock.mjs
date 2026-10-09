/**
 * Testler için sahte iyzico (Checkout Form). Ödeme formunu açar, kendi "ödeme sayfasını" gösterir;
 * "Öde" ya da "Reddet" düğmesi iyzico gibi tarayıcıyı API'nin dönüş adresine token ile POST eder.
 * İmza doğrulaması API e2e testinde yapılır; burada yalnızca akış taklit edilir.
 *
 * Çalıştırma: node e2e/iyzico-mock.mjs (varsayılan port 4200, IYZICO_MOCK_PORT ile değişir)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.IYZICO_MOCK_PORT ?? 4200);
const BASE = `http://127.0.0.1:${PORT}`;
/** token → { init, outcome } */
const forms = new Map();
let seq = 0;

const json = (res, body) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.method === "POST" && url.pathname === "/payment/iyzipos/checkoutform/initialize/auth/ecom") {
      const init = JSON.parse(raw);
      const token = `e2e-${Date.now()}-${++seq}`;
      forms.set(token, { init, outcome: null });
      return json(res, { status: "success", token, paymentPageUrl: `${BASE}/odeme?token=${token}`, tokenExpireTime: 1800 });
    }
    if (req.method === "POST" && url.pathname === "/payment/iyzipos/checkoutform/auth/ecom/detail") {
      const form = forms.get(JSON.parse(raw).token);
      if (!form?.outcome) return json(res, { status: "failure", errorCode: "5059", errorMessage: "Ödeme bulunamadı" });
      if (form.outcome === "reddet") return json(res, { status: "failure", paymentStatus: "FAILURE", errorMessage: "Kart limiti yetersiz" });
      const { price, basketId, conversationId } = form.init;
      return json(res, { status: "success", paymentStatus: "SUCCESS", paymentId: String(10_000_000 + seq), price, paidPrice: price, currency: "TRY", basketId, conversationId, fraudStatus: 1 });
    }
    if (req.method === "POST" && url.pathname === "/odeme") {
      const params = new URLSearchParams(raw);
      const form = forms.get(params.get("token"));
      if (!form) return res.writeHead(404).end();
      form.outcome = params.get("sonuc");
      // iyzico gibi: tarayıcı dönüş adresine token ile POST eder
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><html lang="tr"><body><form id="f" method="post" action="${form.init.callbackUrl}"><input type="hidden" name="token" value="${params.get("token")}"></form><script>document.getElementById("f").submit()</script></body></html>`);
    }
    if (req.method === "GET" && url.pathname === "/odeme") {
      const token = url.searchParams.get("token") ?? "";
      const form = forms.get(token);
      if (!form) return res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><html lang="tr"><head><title>Sahte iyzico</title></head><body><main>
<h1>Sahte iyzico ödeme sayfası</h1><p>Tutar: ${form.init.price} TL</p>
<form method="post" action="/odeme"><input type="hidden" name="token" value="${token}">
<button name="sonuc" value="ode">Öde</button> <button name="sonuc" value="reddet">Reddet</button></form></main></body></html>`);
    }
    if (url.pathname === "/saglik") return json(res, { ok: true });
    res.writeHead(404).end();
  });
}).listen(PORT, "127.0.0.1");
