/**
 * Kaydedilmemiş yazının tarayıcıda yedeği. Kaydetme hata verse ya da sayfa yenilense de yazılar kaybolmasın diye.
 * Yalnızca bu tarayıcıda tutulur; sunucuya gitmez. Depolama kapalıysa sessizce atlanır.
 */
export type DraftBackup = { savedAt: number; values: Record<string, unknown> };

const keyFor = (postId: string | null) => `nakliyat-blog-taslak:${postId ?? "yeni"}`;

export function readDraftText(postId: string | null): string | null {
  try {
    return window.localStorage.getItem(keyFor(postId));
  } catch {
    return null;
  }
}

/** Yedeğin alanları; yazı kayıttan sonra değiştiyse (yedek daha eskiyse) ya da bozuksa null */
export function parseDraft(text: string, updatedAt: string | undefined): Record<string, unknown> | null {
  try {
    const draft = JSON.parse(text) as DraftBackup;
    if (updatedAt && draft.savedAt < new Date(updatedAt).getTime()) return null;
    return draft.values;
  } catch {
    return null;
  }
}

export function writeDraft(postId: string | null, values: Record<string, unknown>) {
  try {
    window.localStorage.setItem(keyFor(postId), JSON.stringify({ savedAt: Date.now(), values } satisfies DraftBackup));
  } catch {
    // Depolama dolu ya da kapalıysa yedek alınmaz; düzenleme yine çalışır
  }
}

export function clearDraft(postId: string | null) {
  try {
    window.localStorage.removeItem(keyFor(postId));
  } catch {
    // yukarıdaki gibi
  }
}
