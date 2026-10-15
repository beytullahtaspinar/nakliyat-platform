"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH, COMPANY_CACHE_TAG, REPLY_MAX_LENGTH } from "@/lib/reviews";

export type ReviewActionState = { error?: string; notice?: string };

const SESSION_ENDED = "Oturumun sona ermiş, lütfen sayfayı yenileyip tekrar giriş yap.";
const failure = (err: unknown, fallback: string): ReviewActionState => ({
  error: err instanceof ApiError ? err.message : fallback,
});

/** Firma sayfaları ve site haritası önbellekten sunulur; puan ya da yorum değişince hemen yenilensin */
const refreshPublicPages = () => updateTag(COMPANY_CACHE_TAG);

/** Müşteri ya da firma işi tamamlandı olarak işaretler; sayfa yeniden çizilir ve değerlendirme açılır. */
export async function completeBooking(bookingId: string, pagePath: string): Promise<ReviewActionState> {
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/complete`, { method: "POST", token });
  } catch (err) {
    return failure(err, "İş tamamlanamadı, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  refreshPublicPages();
  return {};
}

/** Müşteri ya da firma anlaşılan işi gerekçeyle iptal eder; karşı tarafa bildirim gider. */
export async function cancelBooking(
  bookingId: string,
  pagePath: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5 || reason.length > 500) return { error: "İptal nedenini yaz (5-500 karakter)." };
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: "POST", token, body: { reason } });
  } catch (err) {
    return failure(err, "İş iptal edilemedi, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  return {};
}

/** Müşteri ya da firma "taşınma yapılmadı" der; iş kendiliğinden tamamlanmaz, yönetim karar verir. */
export async function disputeBooking(
  bookingId: string,
  pagePath: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5 || reason.length > 500) return { error: "Ne olduğunu kısaca yaz (5-500 karakter)." };
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/dispute`, { method: "POST", token, body: { reason } });
  } catch (err) {
    return failure(err, "İtiraz gönderilemedi, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  return {};
}

/** Yönetici itirazı karara bağlar: taşınma yapıldıysa iş tamamlanır, yapılmadıysa iptal edilir. */
export async function resolveDispute(bookingId: string, _prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "complete" && decision !== "cancel") return { error: "Bir karar seç." };
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 5 || note.length > 500) return { error: "İki tarafın göreceği bir açıklama yaz (5-500 karakter)." };
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/admin/bookings/${encodeURIComponent(bookingId)}/resolve-dispute`, { method: "POST", token, body: { decision, note } });
  } catch (err) {
    return failure(err, "Karar kaydedilemedi, lütfen tekrar dene.");
  }
  revalidatePath("/yonetim", "layout");
  refreshPublicPages();
  return { notice: decision === "complete" ? "İş tamamlandı; iki tarafa bildirildi." : "İş iptal edildi; iki tarafa bildirildi." };
}

/** Puan ve yorum alanlarını okur; hata varsa kullanıcıya gösterilecek metni döner */
function readReview(formData: FormData): { rating: number; comment: string } | { error: string } {
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Lütfen 1 ile 5 arasında bir puan seç." };
  if (comment && (comment.length < COMMENT_MIN_LENGTH || comment.length > COMMENT_MAX_LENGTH)) {
    return { error: `Yorum en az ${COMMENT_MIN_LENGTH}, en fazla ${COMMENT_MAX_LENGTH} karakter olmalı. Yalnızca puan da verebilirsin.` };
  }
  return { rating, comment };
}

export async function submitReview(
  bookingId: string,
  pagePath: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const input = readReview(formData);
  if ("error" in input) return input;
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/review`, {
      method: "POST",
      token,
      body: { rating: input.rating, ...(input.comment && { comment: input.comment }) },
    });
  } catch (err) {
    return failure(err, "Değerlendirmen kaydedilemedi, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  refreshPublicPages();
  return { notice: "Teşekkürler, değerlendirmen yayında." };
}

/** Müşteri puanını ve yorumunu düzenler; yorum boş bırakılırsa yalnızca puan kalır. */
export async function updateReview(
  bookingId: string,
  pagePath: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const input = readReview(formData);
  if ("error" in input) return input;
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/review`, {
      method: "PATCH",
      token,
      body: { rating: input.rating, ...(input.comment && { comment: input.comment }) },
    });
  } catch (err) {
    return failure(err, "Değişiklikler kaydedilemedi, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  refreshPublicPages();
  return { notice: "Değerlendirmen güncellendi." };
}

export async function replyToReview(
  reviewId: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2 || body.length > REPLY_MAX_LENGTH) return { error: `Yanıt 2-${REPLY_MAX_LENGTH} karakter olmalı.` };
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/company/reviews/${encodeURIComponent(reviewId)}/reply`, { method: "POST", token, body: { body } });
  } catch (err) {
    return failure(err, "Yanıt gönderilemedi, lütfen tekrar dene.");
  }
  revalidatePath("/firma-paneli", "layout");
  refreshPublicPages();
  return { notice: "Yanıtın yorumun altında yayında." };
}

export async function hideReview(reviewId: string, _prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Firmanın göreceği bir gerekçe yazın (en az 5 karakter)." };
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/admin/reviews/${encodeURIComponent(reviewId)}/hide`, { method: "POST", token, body: { reason } });
  } catch (err) {
    return failure(err, "Yorum gizlenemedi.");
  }
  revalidatePath("/yonetim/degerlendirmeler");
  refreshPublicPages();
  return { notice: "Yorum gizlendi; firma sayfasından ve puan ortalamasından çıktı." };
}

export async function showReview(reviewId: string): Promise<ReviewActionState> {
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/admin/reviews/${encodeURIComponent(reviewId)}/show`, { method: "POST", token });
  } catch (err) {
    return failure(err, "Yorum yayına alınamadı.");
  }
  revalidatePath("/yonetim/degerlendirmeler");
  refreshPublicPages();
  return { notice: "Yorum yeniden yayında." };
}
