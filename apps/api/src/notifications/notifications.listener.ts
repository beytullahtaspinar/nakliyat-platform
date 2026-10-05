import { Injectable, OnModuleInit } from '@nestjs/common';
import { getCityByCode, getDistrict } from '@nakliyat/locations';
import { formatTrPhone } from '../common/utils/phone.js';
import { DomainEvents } from '../events/domain-events.js';
import type { MovingRequest } from '../generated/prisma/client.js';
import { UserStatus, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { templates } from './templates.js';

const HOME_TYPE_LABELS: Record<string, string> = {
  STUDIO: 'Stüdyo (1+0)',
  ONE_PLUS_ONE: '1+1 ev',
  TWO_PLUS_ONE: '2+1 ev',
  THREE_PLUS_ONE: '3+1 ev',
  FOUR_PLUS_ONE: '4+1 ve üzeri ev',
  VILLA: 'Villa',
  OFFICE: 'Ofis',
};

/** "Kadıköy, İstanbul" biçiminde yer adı. Müşterinin açık adresi bildirimlere hiç girmez. */
const place = (cityCode: string, districtSlug: string) => {
  const city = getCityByCode(cityCode);
  if (!city) return cityCode;
  const district = getDistrict(city, districtSlug);
  return district ? `${district.name}, ${city.name}` : city.name;
};
const route = (r: MovingRequest) => ({
  from: place(r.fromCityCode, r.fromDistrict),
  to: place(r.toCityCode, r.toDistrict),
  moveDate: r.moveDate,
});

/** İş olaylarını dinleyip ilgili kişilere bildirim gönderir. */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  constructor(
    private readonly events: DomainEvents,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.events.on('request.created', ({ requestId }) => this.onRequestCreated(requestId));
    this.events.on('quote.created', ({ quoteId }) => this.onQuoteCreated(quoteId));
    this.events.on('quote.accepted', ({ quoteId }) => this.onQuoteAccepted(quoteId));
    this.events.on('message.sent', ({ messageId }) => this.onMessageSent(messageId));
    this.events.on('booking.move_day_approaching', ({ bookingId }) => this.onMoveDayApproaching(bookingId));
    this.events.on('booking.completed', (p) => this.onBookingCompleted(p.bookingId, p.completedBy));
    this.events.on('booking.cancelled', (p) => this.onBookingCancelled(p.bookingId, p.cancelledBy));
    this.events.on('review.created', ({ reviewId }) => this.onReviewCreated(reviewId));
    this.events.on('company.verification_changed', ({ companyId }) => this.onVerificationChanged(companyId));
  }

  /** Talebin çıkış veya varış iline hizmet veren doğrulanmış firmalara haber ver. */
  async onRequestCreated(requestId: string) {
    const request = await this.prisma.movingRequest.findUnique({ where: { id: requestId } });
    if (!request) return;
    const cities = [...new Set([request.fromCityCode, request.toCityCode])];
    const companies = await this.prisma.company.findMany({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
        deletedAt: null,
        owner: { status: UserStatus.ACTIVE, deletedAt: null },
        OR: [{ cityCode: { in: cities } }, { serviceCities: { some: { cityCode: { in: cities } } } }],
      },
      select: { ownerId: true },
    });
    await this.notifications.notifyMany(
      companies.map((c) => c.ownerId),
      templates.newRequest({
        ...route(request),
        requestId,
        homeTypeLabel: HOME_TYPE_LABELS[request.homeType] ?? request.homeType,
      }),
    );
  }

  async onQuoteCreated(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { request: true, company: { select: { displayName: true } } },
    });
    if (!quote) return;
    await this.notifications.notify(
      quote.request.customerId,
      templates.newQuote({
        ...route(quote.request),
        requestId: quote.requestId,
        companyName: quote.company.displayName,
        priceTry: quote.priceTry.toString(),
      }),
    );
  }

  async onQuoteAccepted(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { request: true, company: { select: { displayName: true, ownerId: true } } },
    });
    if (!quote) return;
    const common = { ...route(quote.request), priceTry: quote.priceTry.toString() };
    await this.notifications.notify(
      quote.request.customerId,
      templates.quoteAcceptedForCustomer({ ...common, requestId: quote.requestId, companyName: quote.company.displayName }),
    );
    await this.notifications.notify(quote.company.ownerId, templates.quoteAcceptedForCompany(common));
  }

  /**
   * Karşı tarafa yeni mesaj bildirimi. Okunmamış mesajı zaten bekleyen kişiye her mesajda yeniden
   * e-posta gitmez: yalnızca okunmamışların ilki bildirilir, okuyunca sıradaki yeni mesaj yine bildirilir.
   */
  async onMessageSent(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        booking: {
          select: {
            id: true,
            requestId: true,
            request: { select: { customerId: true, customer: { select: { fullName: true } } } },
            company: { select: { ownerId: true, displayName: true } },
          },
        },
      },
    });
    if (!message?.booking || message.readAt) return;
    const { booking } = message;
    const earlierUnread = await this.prisma.message.count({
      where: { bookingId: booking.id, senderId: message.senderId, readAt: null, createdAt: { lt: message.createdAt } },
    });
    if (earlierUnread > 0) return;

    const fromCustomer = message.senderId === booking.request.customerId;
    await this.notifications.notify(
      fromCustomer ? booking.company.ownerId : booking.request.customerId,
      templates.newMessage({
        senderName: fromCustomer ? booking.request.customer.fullName : booking.company.displayName,
        body: message.body,
        path: fromCustomer ? `/firma-paneli/isler/${booking.id}` : `/hesabim/talepler/${booking.requestId}#mesajlar`,
      }),
    );
  }

  /** Taşınmadan bir gün önce iki tarafa hatırlatma: karşı tarafın adı ve telefonu da yazılır. */
  async onMoveDayApproaching(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        request: { include: { customer: { select: { fullName: true, phone: true } } } },
        company: { select: { displayName: true, ownerId: true, owner: { select: { phone: true } } } },
      },
    });
    if (!booking) return;
    const { request, company } = booking;
    const common = { ...route(request), moveDate: booking.scheduledAt };
    await this.notifications.notify(
      request.customerId,
      templates.moveReminderForCustomer({
        ...common,
        requestId: request.id,
        companyName: company.displayName,
        companyPhone: formatTrPhone(company.owner.phone),
      }),
    );
    await this.notifications.notify(
      company.ownerId,
      templates.moveReminderForCompany({
        ...common,
        bookingId,
        customerName: request.customer.fullName,
        customerPhone: formatTrPhone(request.customer.phone),
      }),
    );
  }

  /** İptali yapmayan tarafa haber ver. */
  async onBookingCancelled(bookingId: string, cancelledBy: 'CUSTOMER' | 'COMPANY') {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { request: true, company: { select: { ownerId: true, displayName: true } } },
    });
    if (!booking) return;
    const reason = booking.cancelReason ?? '';
    if (cancelledBy === 'COMPANY') {
      await this.notifications.notify(
        booking.request.customerId,
        templates.bookingCancelledForCustomer({
          ...route(booking.request),
          requestId: booking.requestId,
          companyName: booking.company.displayName,
          reason,
        }),
      );
    } else {
      await this.notifications.notify(
        booking.company.ownerId,
        templates.bookingCancelledForCompany({ ...route(booking.request), bookingId, reason }),
      );
    }
  }

  /** Firma işi tamamladıysa müşteriden değerlendirme iste; müşteri kendisi tamamladıysa formu zaten görüyor. */
  async onBookingCompleted(bookingId: string, completedBy: 'CUSTOMER' | 'COMPANY') {
    if (completedBy !== 'COMPANY') return;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { requestId: true, request: { select: { customerId: true } }, company: { select: { displayName: true } } },
    });
    if (!booking) return;
    await this.notifications.notify(
      booking.request.customerId,
      templates.reviewRequest({ companyName: booking.company.displayName, requestId: booking.requestId }),
    );
  }

  async onReviewCreated(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { rating: true, comment: true, company: { select: { ownerId: true } } },
    });
    if (!review) return;
    await this.notifications.notify(review.company.ownerId, templates.newReview(review));
  }

  async onVerificationChanged(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;
    if (company.verificationStatus === VerificationStatus.VERIFIED) {
      await this.notifications.notify(company.ownerId, templates.companyVerified({ companyName: company.displayName }));
    } else if (company.verificationStatus === VerificationStatus.REJECTED) {
      await this.notifications.notify(
        company.ownerId,
        templates.companyRejected({ companyName: company.displayName, reason: company.verificationNote }),
      );
    }
  }
}
