"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "./review-form";

/** Müşterinin yayındaki değerlendirmesini düzenlemesi: form düğmeyle açılır, puan ve yorum dolu gelir. */
export function ReviewEditor({
  bookingId,
  pagePath,
  companyName,
  review,
  hasReply,
}: {
  bookingId: string;
  pagePath: string;
  companyName: string;
  review: { rating: number; comment: string | null };
  hasReply: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
        Değerlendirmeni düzenle
      </Button>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="font-semibold text-zinc-900">Değerlendirmeni düzenle</h3>
      <p className="mt-1 mb-4 text-sm text-zinc-600">
        Puanını ve yorumunu güncelleyebilirsin; yorumun yanında &ldquo;düzenlendi&rdquo; yazar ve firmaya haber verilir.
        {hasReply && " Firmanın yanıtı yerinde kalır, firma yanıtını yeni yorumuna göre güncelleyebilir."}
      </p>
      <ReviewForm bookingId={bookingId} pagePath={pagePath} companyName={companyName} initial={review} />
      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(false)}>
        Kapat
      </Button>
    </div>
  );
}
