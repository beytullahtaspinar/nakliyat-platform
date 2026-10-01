"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, type NotificationPreferences } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export type PreferencesFormState = { error?: string; saved?: boolean };

/**
 * Bildirim tercihlerini kaydeder. Formda her tür/kanal için "pref:<TÜR>:<KANAL>" adlı bir onay kutusu
 * ve listelenen türleri taşıyan gizli "pref" alanları bulunur; işaretsiz kutu kapalı demektir.
 */
export async function saveNotificationPreferences(
  settingsPath: string,
  _prev: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const token = await getAccessToken();
  if (!token) return { error: "Oturumun sona ermiş, lütfen tekrar giriş yap." };

  const email = String(formData.get("email") ?? "").trim();
  const items = formData.getAll("pref").map(String).map((key) => {
    const [type, channel] = key.split(":");
    return { type, channel, enabled: formData.get(`pref:${key}`) === "on" };
  });

  try {
    await apiFetch<NotificationPreferences>("/notifications/preferences", {
      method: "PATCH",
      token,
      body: { email: email || null, items },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Bildirim ayarları kaydedilemedi." };
  }
  revalidatePath(settingsPath);
  return { saved: true };
}
