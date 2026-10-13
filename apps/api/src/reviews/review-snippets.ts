import { getCityByCode } from '@nakliyat/locations';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { maskName } from './review-rules.js';

/** Herkese açık yorumda yazarın adı ve güzergâh için gereken ilişkiler */
export const AUTHOR_AND_ROUTE = {
  customer: { select: { fullName: true, deletedAt: true } },
  booking: { select: { requestId: true, scheduledAt: true, request: { select: { fromCityCode: true, toCityCode: true } } } },
} satisfies Prisma.ReviewInclude;
type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: typeof AUTHOR_AND_ROUTE }>;

/** "İzmir → Ankara": yalnızca il adları, ilçe ve adres yok */
export const routeOf = (r: { fromCityCode: string; toCityCode: string }) => {
  const from = getCityByCode(r.fromCityCode)?.name ?? r.fromCityCode;
  const to = getCityByCode(r.toCityCode)?.name ?? r.toCityCode;
  return from === to ? `${from} içi` : `${from} → ${to}`;
};

/**
 * Herkese açık yorum: müşterinin adı kısaltılır, gizlenme bilgisi yok. Her yorum platformda anlaşılıp
 * tamamlanan bir taşımaya bağlıdır; taşınma ayı "doğrulanmış taşıma" rozetinin yanında gösterilir.
 */
export function toPublicReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    authorName: maskName(review.customer.fullName, !!review.customer.deletedAt),
    route: routeOf(review.booking.request),
    moveDate: review.booking.scheduledAt,
    createdAt: review.createdAt,
    editedAt: review.editedAt,
    companyReply: review.companyReply,
    companyReplyAt: review.companyReplyAt,
  };
}

/** Yorum alıntısının en fazla uzunluğu (teklif kartı) */
const EXCERPT_LENGTH = 180;

const excerptOf = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= EXCERPT_LENGTH) return flat;
  const cut = flat.slice(0, EXCERPT_LENGTH);
  const space = cut.lastIndexOf(' ');
  return `${(space > 100 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, '')}…`;
};

/**
 * Her firmanın en yeni yazılı ve yayındaki yorumu, kısaltılmış (teklif karşılaştırmada firma satırının altında).
 * Puana göre seçilmez: müşteri iyi ya da kötü, en güncel deneyimi görür.
 */
export async function latestReviewExcerpts(prisma: PrismaService, companyIds: string[]) {
  const ids = [...new Set(companyIds)];
  if (ids.length === 0) return new Map<string, ReturnType<typeof toExcerpt>>();
  const rows = await Promise.all(
    ids.map((companyId) =>
      prisma.review.findFirst({
        where: { companyId, isPublished: true, comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: AUTHOR_AND_ROUTE,
      }),
    ),
  );
  return new Map(rows.filter((r) => r !== null).map((r) => [r.companyId, toExcerpt(r)]));
}

function toExcerpt(review: ReviewWithAuthor) {
  return {
    rating: review.rating,
    excerpt: excerptOf(review.comment ?? ''),
    authorName: maskName(review.customer.fullName, !!review.customer.deletedAt),
    route: routeOf(review.booking.request),
    moveDate: review.booking.scheduledAt,
  };
}
