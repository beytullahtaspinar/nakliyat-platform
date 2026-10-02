import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext } from "@playwright/test";

const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
export const PDF_PATH = path.join(__dirname, "fixtures", "belge.pdf");

export const nextYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/** Firmanın zorunlu üç belgesini API üzerinden yükler (yönetim testleri için) */
export async function uploadRequiredDocuments(request: APIRequestContext, token: string) {
  const pdf = readFileSync(PDF_PATH);
  const headers = { Authorization: `Bearer ${token}` };
  for (const type of ["K3_LICENSE", "TAX_CERTIFICATE", "TRADE_REGISTRY"]) {
    const ticket = await request.post(`${API}/company/documents/uploads`, {
      headers,
      data: { mimeType: "application/pdf", sizeBytes: pdf.length },
    });
    expect(ticket.ok()).toBeTruthy();
    const { key, url } = await ticket.json();
    const put = await request.put(url, { headers: { "Content-Type": "application/pdf" }, data: pdf });
    expect(put.status()).toBe(204);
    const attach = await request.post(`${API}/company/documents`, {
      headers,
      data: { type, key, fileName: `${type.toLowerCase()}.pdf`, ...(type === "K3_LICENSE" && { validUntil: nextYear() }) },
    });
    expect(attach.ok()).toBeTruthy();
  }
}
