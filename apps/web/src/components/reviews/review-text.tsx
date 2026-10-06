/** Uzun yorum bu uzunluktan sonra kısaltılır, "Tamamını oku" ile açılır */
const SHORT = 180;

/**
 * Tablo hücresi için yorum metni: kısa yorum olduğu gibi, uzun yorum ilk satırlarıyla gösterilir.
 * Firma yanıtı varsa altında kısa bir kutu olarak durur.
 */
export function ReviewText({
  comment,
  companyReply,
  companyName,
}: {
  comment: string | null;
  companyReply: string | null;
  companyName: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      {comment ? (
        comment.length > SHORT ? (
          <details className="group">
            <summary className="cursor-pointer list-none text-slate-900 [&::-webkit-details-marker]:hidden">
              <span className="line-clamp-3 whitespace-pre-line group-open:line-clamp-none">{comment}</span>
              <span className="mt-1 inline-block text-xs font-semibold text-brand-700 group-open:hidden">Tamamını oku</span>
            </summary>
          </details>
        ) : (
          <p className="whitespace-pre-line text-slate-900">{comment}</p>
        )
      ) : (
        <p className="text-slate-500 italic">Yorum yazılmadan puan verildi.</p>
      )}
      {companyReply && (
        <div className="rounded-lg border-l-4 border-brand-600 bg-brand-50 px-3 py-1.5 text-xs">
          <p className="font-semibold text-brand-900">{companyName} yanıtı</p>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-slate-800">{companyReply}</p>
        </div>
      )}
    </div>
  );
}
