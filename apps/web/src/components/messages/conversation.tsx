"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import type { BookingMessage, Conversation as ConversationData } from "@/lib/api";
import { loadConversation, sendMessage } from "@/lib/actions/messages";
import { inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

/** Ekran açık ve görünürken yeni mesajlar bu aralıkla sorulur (sunucu Passenger'da, soket yok). */
const POLL_MS = 10_000;
const MAX_LENGTH = 2000;

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/**
 * Müşteri ile firma arasındaki yazışma. İlk mesajlar sunucuda yüklenir; sonra sayfa görünür
 * oldukça düzenli aralıkla yenilenir. Yeni mesaj gelince karşı tarafa e-posta bildirimi API'den gider.
 */
export function Conversation({
  initial,
  refreshBadges = false,
}: {
  initial: ConversationData;
  /** Sayfa açılınca mesajlar okundu sayılır; menüdeki okunmamış rozeti de güncellensin diye düzen yenilenir */
  refreshBadges?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [sending, startSending] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const lastId = data.items.at(-1)?.id;

  const refresh = useCallback(async () => {
    const result = await loadConversation(initial.bookingId);
    if (result.conversation) setData(result.conversation);
  }, [initial.bookingId]);

  useEffect(() => {
    if (refreshBadges) router.refresh();
  }, [refreshBadges, router]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        clearInterval(timer);
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Yeni mesaj gelince listenin sonuna kaydır (sayfanın kendisi kaymaz)
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lastId]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setError(undefined);
    startSending(async () => {
      const result = await sendMessage(initial.bookingId, body);
      if (result.message) {
        const message: BookingMessage = result.message;
        setDraft("");
        setData((d) => ({ ...d, items: [...d.items, message] }));
      } else {
        setError(result.error);
      }
    });
  };

  // Masaüstünde Enter gönderir, Shift+Enter alt satıra geçer
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      submit();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      {data.items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-600">
          Henüz mesaj yok. Taşınma saati, eşyalar ya da adres tarifi gibi konuları buradan {data.counterpart} ile
          konuşabilirsin.
        </p>
      ) : (
        <ol
          ref={listRef}
          aria-label={`${data.counterpart} ile mesajlar`}
          aria-live="polite"
          tabIndex={0}
          className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-4"
        >
          {data.items.map((m) => (
            <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.mine ? "rounded-br-sm bg-brand-700 text-white" : "rounded-bl-sm bg-zinc-100 text-zinc-900"
                }`}
              >
                <p className="sr-only">{m.mine ? "Sen:" : `${data.counterpart}:`}</p>
                {m.body ? (
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                ) : (
                  <p className="italic opacity-80">Bu mesaj silindi</p>
                )}
                <p className={`mt-1 text-xs ${m.mine ? "text-brand-100" : "text-zinc-600"}`}>
                  <time dateTime={m.createdAt}>{timeFormat.format(new Date(m.createdAt))}</time>
                  {m.mine && m.readAt && " · Görüldü"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {data.canSend ? (
        <form onSubmit={submit} className="border-t border-zinc-200 p-3">
          <label htmlFor={`mesaj-${data.bookingId}`} className="sr-only">
            {data.counterpart} için mesajın
          </label>
          <textarea
            id={`mesaj-${data.bookingId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder="Mesajını yaz…"
            className={`${inputClass} mt-0 resize-y`}
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-600">{data.counterpart} yeni mesajını e-postayla da öğrenir.</p>
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? "Gönderiliyor…" : "Gönder"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
          Bu konuşma kapandı, yeni mesaj gönderilemez.
        </p>
      )}
    </div>
  );
}
