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

export async function submitReview(
  bookingId: string,
  pagePath: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Lütfen 1 ile 5 arasında bir puan seç." };
  if (comment && (comment.length < COMMENT_MIN_LENGTH || comment.length > COMMENT_MAX_LENGTH)) {
    return { error: `Yorum en az ${COMMENT_MIN_LENGTH}, en fazla ${COMMENT_MAX_LENGTH} karakter olmalı. Yalnızca puan da verebilirsin.` };
  }
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/review`, {
      method: "POST",
      token,
      body: { rating, ...(comment && { comment }) },
    });
  } catch (err) {
    return failure(err, "Değerlendirmen kaydedilemedi, lütfen tekrar dene.");
  }
  revalidatePath(pagePath);
  refreshPublicPages();
  return { notice: "Teşekkürler, değerlendirmen yayında." };
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
