import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { ReportStatus, ReportTarget, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import type { CreateReportDto, ListReportsDto, ResolveReportDto } from './report.dto.js';

/** Bildirilen içeriğin özeti: kim yazdı, hangi işte, metni ne */
interface ReportedContent {
  authorId: string | null;
  bookingId: string | null;
  content: string;
}

/**
 * İçerik bildirimi (App Store 1.2, Google Play kullanıcı içeriği kuralı). Kullanıcı yalnızca kendisine gösterilen
 * ve başkasının yazdığı içeriği bildirebilir: karşı tarafın mesajı, firmaya yazılan yorum (firma), yoruma firmanın
 * yanıtı (müşteri). Yönetici bildirimi inceler; haklıysa içeriği kaldırır, gerekirse hesabı siler.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async create(user: AuthUser, dto: CreateReportDto) {
    if (user.impersonatorId) throw new ForbiddenException('Bildirimi hesabın sahibi yapmalı');
    const reported = await this.findReportable(user, dto.target, dto.targetId);
    // Aynı kişi aynı içeriği bir kez bildirir; ikinci dokunuş ilk bildirimi döner
    const existing = await this.prisma.contentReport.findFirst({
      where: { reporterId: user.id, target: dto.target, targetId: dto.targetId, status: ReportStatus.OPEN },
      select: { id: true, status: true },
    });
    if (existing) return existing;
    return this.prisma.contentReport.create({
      data: {
        reporterId: user.id,
        target: dto.target,
        targetId: dto.targetId,
        reason: dto.reason,
        note: dto.note ?? null,
        ...reported,
      },
      select: { id: true, status: true },
    });
  }

  private async findReportable(user: AuthUser, target: ReportTarget, id: string): Promise<ReportedContent> {
    const notFound = new NotFoundException('İçerik bulunamadı');
    if (target === ReportTarget.MESSAGE) {
      const message = await this.prisma.message.findUnique({
        where: { id },
        select: {
          body: true,
          senderId: true,
          bookingId: true,
          booking: { select: { companyId: true, company: { select: { ownerId: true } }, request: { select: { customerId: true } } } },
        },
      });
      const booking = message?.booking;
      const isParty =
        !!booking &&
        ((user.role === UserRole.CUSTOMER && booking.request.customerId === user.id) ||
          (user.role === UserRole.COMPANY && booking.company.ownerId === user.id));
      if (!message || !isParty) throw notFound;
      if (message.senderId === user.id) throw new BadRequestException('Kendi mesajını bildiremezsin');
      return { authorId: message.senderId, bookingId: message.bookingId, content: message.body || '(mesaj silinmiş)' };
    }

    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { rating: true, comment: true, companyReply: true, customerId: true, bookingId: true, company: { select: { ownerId: true } } },
    });
    if (!review) throw notFound;
    if (target === ReportTarget.REVIEW) {
      if (user.role !== UserRole.COMPANY || review.company.ownerId !== user.id) throw notFound;
      return { authorId: review.customerId, bookingId: review.bookingId, content: review.comment || `${review.rating} puan (yorum yok)` };
    }
    if (user.role !== UserRole.CUSTOMER || review.customerId !== user.id || !review.companyReply) throw notFound;
    return { authorId: review.company.ownerId, bookingId: review.bookingId, content: review.companyReply };
  }

  /** Yönetim listesi: bildiren, içeriğin sahibi ve ilgili talep bağlantısıyla */
  async list(dto: ListReportsDto) {
    const where = { status: dto.status };
    const [total, rows, open] = await this.prisma.$transaction([
      this.prisma.contentReport.count({ where }),
      this.prisma.contentReport.findMany({
        where,
        orderBy: { createdAt: dto.status === ReportStatus.OPEN ? 'asc' : 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.contentReport.count({ where: { status: ReportStatus.OPEN } }),
    ]);
    const userIds = [...new Set(rows.flatMap((r) => [r.reporterId, r.authorId].filter((x): x is string => !!x)))];
    const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter((x): x is string => !!x))];
    const [users, bookings] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, role: true, deletedAt: true, company: { select: { displayName: true } } },
      }),
      this.prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, requestId: true } }),
    ]);
    const person = (id: string | null) => {
      const u = users.find((x) => x.id === id);
      return u
        ? { id: u.id, name: u.company?.displayName ?? u.fullName, role: u.role, deleted: !!u.deletedAt }
        : null;
    };
    return {
      counts: { open },
      total,
      page: dto.page,
      limit: dto.limit,
      items: rows.map((r) => ({
        id: r.id,
        target: r.target,
        targetId: r.targetId,
        reason: r.reason,
        note: r.note,
        content: r.content,
        status: r.status,
        resolution: r.resolution,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: person(r.reporterId),
        author: person(r.authorId),
        requestId: bookings.find((b) => b.id === r.bookingId)?.requestId ?? null,
      })),
    };
  }

  /**
   * Bildirimi kapatır. removeContent: mesaj metni silinir, yorum gerekçeyle gizlenir, firma yanıtı silinir.
   * Aynı içeriğe gelen diğer açık bildirimler de aynı kararla kapanır.
   */
  async resolve(adminId: string, id: string, dto: ResolveReportDto) {
    const report = await this.prisma.contentReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Bildirim bulunamadı');
    if (dto.removeContent && dto.status === ReportStatus.RESOLVED) {
      if (report.target === ReportTarget.MESSAGE) {
        await this.prisma.message.updateMany({ where: { id: report.targetId }, data: { body: '' } });
      } else if (report.target === ReportTarget.REVIEW) {
        await this.reviews.hide(adminId, report.targetId, dto.resolution || 'Kullanıcı bildirimi üzerine kural dışı bulundu.');
      } else {
        await this.prisma.review.updateMany({ where: { id: report.targetId }, data: { companyReply: null, companyReplyAt: null } });
      }
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.contentReport.updateMany({
        where: { OR: [{ id }, { target: report.target, targetId: report.targetId, status: ReportStatus.OPEN }] },
        data: { status: dto.status, resolution: dto.resolution ?? null, resolvedById: adminId, resolvedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'report.resolve',
          entityType: 'ContentReport',
          entityId: id,
          details: { status: dto.status, removeContent: !!dto.removeContent, target: report.target, targetId: report.targetId },
        },
      }),
    ]);
    return { id, status: dto.status };
  }
}
