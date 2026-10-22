import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext } from "@playwright/test";

const API = `http://localhost:${process.env.API_PORT ?? 4000}/v1`;
export const PDF_PATH = path.join(__dirname, "fixtures", "belge.pdf");
export const PHOTO_PATH = path.join(__dirname, "fixtures", "esya.jpg");

export const nextYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/** Rastgele, biçimi geçerli plaka (paralel testlerde çakışmaz) */
export const randomPlate = () => {
  const letters = Array.from({ length: 3 }, () => "ABCDEFGHJKLMNPRSTUVYZ"[Math.floor(Math.random() * 21)]).join("");
  return `${String(1 + Math.floor(Math.random() * 81)).padStart(2, "0")}${letters}${100 + Math.floor(Math.random() * 900)}`;
};

/** Firmaya ruhsat (PDF) ve üç fotoğrafla bir araç ekler (firma onayı için gerekir) */
export async function uploadVehicle(request: APIRequestContext, token: string, plate = randomPlate()) {
  const headers = { Authorization: `Bearer ${token}` };
  const files: Record<string, { key: string; fileName: string }> = {};
  for (const kind of ["REGISTRATION", "FRONT", "SIDE", "REAR"]) {
    const pdf = kind === "REGISTRATION";
    const body = readFileSync(pdf ? PDF_PATH : PHOTO_PATH);
    const mimeType = pdf ? "application/pdf" : "image/jpeg";
    const ticket = await request.post(`${API}/company/vehicles/uploads`, {
      headers,
      data: { kind, mimeType, sizeBytes: body.length },
    });
    expect(ticket.ok()).toBeTruthy();
    const { key, url } = await ticket.json();
    const put = await request.put(url, { headers: { "Content-Type": mimeType }, data: body });
    expect(put.status()).toBe(204);
    files[kind] = { key, fileName: pdf ? "ruhsat.pdf" : `${kind.toLowerCase()}.jpg` };
  }
  const saved = await request.post(`${API}/company/vehicles`, {
    headers,
    data: { plate, type: "KAMYON", authorization: "K3", files },
  });
  expect(saved.ok()).toBeTruthy();
}

/** Firmanın zorunlu üç belgesini ve bir aracını API üzerinden yükler (yönetim testleri için) */
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
  await uploadVehicle(request, token);
}
