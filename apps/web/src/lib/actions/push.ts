"use server";

import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export type PushResult = { error?: string };

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

async function call(path: string, method: "POST" | "DELETE", body?: unknown): Promise<PushResult & { sent?: boolean }> {
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };
  try {
    const res = await apiFetch<{ sent?: boolean } | undefined>(path, { method, token, body });
    return { sent: res?.sent };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "İşlem tamamlanamadı, tekrar dene." };
  }
}

/** Bu cihazı oturumdaki hesabın anlık bildirimlerine kaydeder. */
export async function subscribePush(subscription: Subscription): Promise<PushResult> {
  return call("/notifications/push/subscriptions", "POST", {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });
}

export async function unsubscribePush(endpoint: string): Promise<PushResult> {
  return call("/notifications/push/subscriptions", "DELETE", { endpoint });
}

export async function sendTestPush(): Promise<PushResult & { sent?: boolean }> {
  return call("/notifications/push/test", "POST");
}
