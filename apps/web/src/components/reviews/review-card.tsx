import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { RATING_LABELS } from "@/lib/reviews";
import { Stars } from "./stars";

type ReviewLike = {
  rating: number;
  comment: string | null;
  companyReply: string | null;
  companyReplyAt: string | null;
  createdAt: string;
};

/**
 * Tek değerlendirme: yıldızlar, yorum ve varsa firmanın yanıtı. Başlık satırına yazar/güzergâh,
 * altına ek içerik (gizlenme notu, yanıt formu) verilebilir.
 */
export function ReviewCard({
  review,
  author,
  companyName,
  children,
  as: Tag = "div",
}: {
  review: ReviewLike;
  author?: ReactNode;
  companyName: string;
  children?: ReactNode;
  as?: "div" | "li" | "article";
}) {
  return (
    <Tag className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="text-sm font-semibold text-zinc-900">{RATING_LABELS[review.rating]}</span>
        <span className="text-sm text-zinc-600">{formatDate(review.createdAt)}</span>
      </div>
      {author && <p className="mt-1 text-sm text-zinc-700">{author}</p>}
      {review.comment ? (
        <p className="mt-2 whitespace-pre-line text-zinc-900">{review.comment}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">Yorum yazılmadan puan verildi.</p>
      )}
      {review.companyReply && (
        <div className="mt-3 rounded-lg border-l-4 border-brand-600 bg-brand-50 px-3 py-2">
          <p className="text-sm font-semibold text-brand-900">
            {companyName} yanıtı
            {review.companyReplyAt && <span className="font-normal text-zinc-700"> · {formatDate(review.companyReplyAt)}</span>}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-zinc-900">{review.companyReply}</p>
        </div>
      )}
      {children}
    </Tag>
  );
}
