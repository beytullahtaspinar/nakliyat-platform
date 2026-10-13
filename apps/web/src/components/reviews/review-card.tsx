import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { RATING_LABELS } from "@/lib/reviews";
import { Stars } from "./stars";
import { VerifiedMove } from "./verified-move";

type ReviewLike = {
  rating: number;
  comment: string | null;
  companyReply: string | null;
  companyReplyAt: string | null;
  createdAt: string;
  editedAt?: string | null;
};

/** Müşteri yorumu firmanın yanıtından sonra düzenledi: yanıt eski metne ait */
export const replyPredatesEdit = (r: { editedAt?: string | null; companyReplyAt: string | null }) =>
  !!(r.editedAt && r.companyReplyAt && new Date(r.editedAt) > new Date(r.companyReplyAt));

/**
 * Tek değerlendirme: yıldızlar, yorum ve varsa firmanın yanıtı. Başlık satırına yazar, verified ile
 * "doğrulanmış taşıma" rozeti (taşınma ayı ve güzergâh), altına ek içerik (gizlenme notu, yanıt formu) verilebilir.
 */
export function ReviewCard({
  review,
  author,
  verified,
  companyName,
  children,
  as: Tag = "div",
}: {
  review: ReviewLike;
  author?: ReactNode;
  verified?: { moveDate: string; route: string };
  companyName: string;
  children?: ReactNode;
  as?: "div" | "li" | "article";
}) {
  return (
    <Tag className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="text-sm font-semibold text-zinc-900">{RATING_LABELS[review.rating]}</span>
        <span className="text-sm text-zinc-600">
          {formatDate(review.createdAt)}
          {review.editedAt && <span title={`Son düzenleme: ${formatDate(review.editedAt)}`}> · düzenlendi</span>}
        </span>
      </div>
      {author && <p className="mt-1 text-sm font-medium text-zinc-800">{author}</p>}
      {verified && <VerifiedMove moveDate={verified.moveDate} route={verified.route} className="mt-2" />}
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
          {replyPredatesEdit(review) && (
            <p className="mt-1 text-xs text-zinc-600">Bu yanıt, yorumun düzenlenmeden önceki hâline verildi.</p>
          )}
        </div>
      )}
      {children}
    </Tag>
  );
}
