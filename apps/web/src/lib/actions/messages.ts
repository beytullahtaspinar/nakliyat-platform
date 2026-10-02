"use server";

import { ApiError, apiFetch, type BookingMessage, type Conversation } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export type ConversationResult = { conversation?: Conversation; error?: string };
export type SendResult = { message?: BookingMessage; error?: string };

const SESSION_ENDED = "Oturumun sona ermiş, lütfen sayfayı yenileyip tekrar giriş yap.";

/** Konuşmayı yeniden yükler (ekran açıkken birkaç saniyede bir çağrılır). */
export async function loadConversation(bookingId: string): Promise<ConversationResult> {
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    return {
      conversation: await apiFetch<Conversation>(`/bookings/${encodeURIComponent(bookingId)}/messages`, { token }),
    };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Mesajlar yüklenemedi." };
  }
}

export async function sendMessage(bookingId: string, body: string): Promise<SendResult> {
  const token = await getAccessToken();
  if (!token) return { error: SESSION_ENDED };
  try {
    return {
      message: await apiFetch<BookingMessage>(`/bookings/${encodeURIComponent(bookingId)}/messages`, {
        method: "POST",
        token,
        body: { body },
      }),
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) return { error: "Mesaj boş olamaz ve en fazla 2000 karakter olabilir." };
    return { error: err instanceof ApiError ? err.message : "Mesaj gönderilemedi, lütfen tekrar dene." };
  }
}
