import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { DomainEvents } from '../events/domain-events.js';
import { BookingStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Konuşma ekranında gösterilen en fazla mesaj (en yeniler) */
const HISTORY_LIMIT = 200;

/** İşin tarafları: mesajı kim yazdıysa karşısındaki alıcıdır. */
const BOOKING_PARTIES = {
  id: true,
  status: true,
  requestId: true,
  companyId: true,
  request: { select: { customerId: true, customer: { select: { fullName: true, deletedAt: true } } } },
  company: { select: { ownerId: true, displayName: true, deletedAt: true } },
} as const;

/**
 * Teklif kabul edildikten sonra müşteri ile firma arasındaki yazışma. Konuşma işe (Booking) bağlıdır;
 * yalnızca işin müşterisi ve firması görür. Taraflar bu noktada birbirinin iletişim bilgisini zaten
 * gördüğü için telefon ve adres süzülmez; yalnızca küfür süzgecinden geçer (SendMessageDto). İptal edilen işin
 * konuşması salt okunur kalır. Taraflar birbirini engelleyebilir ve mesajı bildirebilir (moderation modülü).
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  private async requireBooking(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: BOOKING_PARTIES });
    const isCustomer = user.role === UserRole.CUSTOMER && booking?.request.customerId === user.id;
    const isCompany = user.role === UserRole.COMPANY && booking?.company.ownerId === user.id;
    // Başkasının işi "yok" gibi görünür: varlığı da sızmasın
    if (!booking || (!isCustomer && !isCompany)) throw new NotFoundException('İş bulunamadı');
    const counterpartGone = isCustomer ? !!booking.company.deletedAt : !!booking.request.customer.deletedAt;
    const me = isCustomer ? UserRole.CUSTOMER : UserRole.COMPANY;
    const blocks = await this.prisma.messagingBlock.findMany({
      where: { customerId: booking.request.customerId, companyId: booking.companyId },
      select: { blockedBy: true },
    });
    const blocked = {
      byMe: blocks.some((b) => b.blockedBy === me),
      byThem: blocks.some((b) => b.blockedBy !== me),
    };
    return {
      booking,
      me,
      blocked,
      counterpart: isCustomer ? booking.company.displayName : booking.request.customer.fullName,
      canSend: booking.status !== BookingStatus.CANCELLED && !counterpartGone && !blocked.byMe && !blocked.byThem,
    };
  }

  /**
   * Konuşmayı döner ve karşı taraftan gelen okunmamış mesajları okundu sayar. Yönetici firma panelini
   * firmanın gözünden görüntülüyorsa okundu bilgisi değişmez: firma mesajı kendisi görmemiştir.
   */
  async list(user: AuthUser, bookingId: string) {
    const { booking, counterpart, canSend, blocked } = await this.requireBooking(user, bookingId);
    if (!user.impersonatorId) {
      await this.prisma.message.updateMany({
        where: { bookingId, senderId: { not: user.id }, readAt: null },
        data: { readAt: new Date() },
      });
    }
    const rows = await this.prisma.message.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    return {
      bookingId: booking.id,
      requestId: booking.requestId,
      counterpart,
      canSend,
      blocked,
      items: rows.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderId === user.id,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
    };
  }

  async send(user: AuthUser, bookingId: string, body: string) {
    const { booking, canSend, blocked } = await this.requireBooking(user, bookingId);
    if (!canSend) {
      throw new ConflictException(
        booking.status === BookingStatus.CANCELLED
          ? 'Bu iş iptal edildiği için mesaj gönderilemez'
          : blocked.byMe
            ? 'Bu kişiyi engellediğin için mesaj gönderemezsin. Engeli kaldırınca yazabilirsin.'
            : blocked.byThem
              ? 'Bu konuşmada mesaj gönderilemiyor'
              : 'Karşı taraf hesabını kapattığı için mesaj gönderilemez',
      );
    }
    const message = await this.prisma.message.create({ data: { bookingId, senderId: user.id, body } });
    this.events.emit('message.sent', { messageId: message.id });
    return { id: message.id, body: message.body, mine: true, createdAt: message.createdAt, readAt: null };
  }

  /**
   * Karşı tarafı engeller: engel varken iki taraf da bu müşteri-firma ikilisinin hiçbir işinde mesaj gönderemez.
   * Yönetici başkasının adına engel koyamaz/kaldıramaz.
   */
  async block(user: AuthUser, bookingId: string) {
    if (user.impersonatorId) throw new ForbiddenException('Engellemeyi hesabın sahibi yapmalı');
    const { booking, me } = await this.requireBooking(user, bookingId);
    const key = { customerId: booking.request.customerId, companyId: booking.companyId, blockedBy: me };
    await this.prisma.messagingBlock.upsert({ where: { customerId_companyId_blockedBy: key }, create: key, update: {} });
    return this.list(user, bookingId);
  }

  async unblock(user: AuthUser, bookingId: string) {
    if (user.impersonatorId) throw new ForbiddenException('Engeli hesabın sahibi kaldırmalı');
    const { booking, me } = await this.requireBooking(user, bookingId);
    await this.prisma.messagingBlock.deleteMany({
      where: { customerId: booking.request.customerId, companyId: booking.companyId, blockedBy: me },
    });
    return this.list(user, bookingId);
  }

  /** Kullanıcının okunmamış mesajları, iş başına sayılarıyla (menü ve liste rozetleri için). */
  async unread(user: AuthUser) {
    const party =
      user.role === UserRole.COMPANY ? { company: { ownerId: user.id } } : { request: { customerId: user.id } };
    const groups = await this.prisma.message.groupBy({
      by: ['bookingId'],
      where: { readAt: null, senderId: { not: user.id }, booking: party },
      _count: { _all: true },
    });
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: groups.map((g) => g.bookingId!) } },
      select: { id: true, requestId: true },
    });
    const requestOf = new Map(bookings.map((b) => [b.id, b.requestId]));
    const items = groups.map((g) => ({ bookingId: g.bookingId!, requestId: requestOf.get(g.bookingId!)!, count: g._count._all }));
    return { total: items.reduce((sum, i) => sum + i.count, 0), items };
  }
}
