import type { UploadTicket } from "@/lib/actions/media";

/** Dosyayı yükleme adresine gönderir. İlerleme gösterebilmek için fetch yerine XMLHttpRequest. */
export function putFile(ticket: UploadTicket, blob: Blob, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.url);
    for (const [name, value] of Object.entries(ticket.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}
