import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { VerificationStatus } from '../generated/prisma/enums.js';
import { DomainEvents } from '../events/domain-events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { formatDate } from '../notifications/templates.js';
import { nameChangeQuota, nameChangeWindowStart, normalizeName } from './name-change-rules.js';

const ADMIN_VIEW = {
  company: { select: { id: true, displayName: true, legalName: true, verificationStatus: true } },
} satisfies Prisma.CompanyNameChangeInclude;

/**
 * Onaylı firmanın görünen ad değişikliği: talep, yönetim kararı ve yıllık sınır.
 * Kurallar: name-change-rules.ts
 */
@Injectable()
export class CompanyNameChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  /** Firma paneli için: bekleyen talep, son ret ve kalan hak */
  async stateFor(companyId: string) {
    const [pending, lastDecided, approved] = await Promise.all([
      this.prisma.companyNameChange.findFirst({
        where: { companyId, status: VerificationStatus.PENDING },
        select: { newName: true, createdAt: true },
      }),
      this.prisma.companyNameChange.findFirst({
        where: { companyId, status: { not: VerificationStatus.PENDING } },
        orderBy: { reviewedAt: 'desc' },
        select: { newName: true, status: true, reviewNote: true, reviewedAt: true },
      }),
      this.approvedDates(companyId),
    ]);
    return {
      pending,
      // Yalnızca son karar ret ise gösterilir: firma gerekçeyi görüp yeniden deneyebilsin
      lastRejected: lastDecided?.status === VerificationStatus.REJECTED ? lastDecided : null,
      ...nameChangeQuota(approved),
    };
  }

  /**
   * Firmanın istediği yeni adı onaya gönderir. Bekleyen talep varsa onun yerine geçer (tek bekleyen
   * talep olur); yayındaki ada geri dönülürse bekleyen talep geri çekilir.
   */
  async request(company: { id: string; displayName: string }, rawName: string, actorId: string) {
    const newName = normalizeName(rawName);
    const pending = await this.prisma.companyNameChange.findFirst({
      where: { companyId: company.id, status: VerificationStatus.PENDING },
    });
    if (newName === normalizeName(company.displayName)) {
      if (pending) await this.prisma.companyNameChange.delete({ where: { id: pending.id } });
      return;
    }
    if (pending?.newName === newName) return;

    const quota = nameChangeQuota(await this.approvedDates(company.id));
    if (quota.remaining === 0) {
      throw new BadRequestException(
        `Görünen adı yılda en fazla ${quota.limit} kez değiştirebilirsin. Bir sonraki değişiklik ${formatDate(quota.nextAvailableAt!)} tarihinden sonra yapılabilir.`,
      );
    }
    await this.prisma.$transaction([
      pending
        ? this.prisma.companyNameChange.update({
            where: { id: pending.id },
            data: { newName, oldName: company.displayName, createdAt: new Date() },
          })
        : this.prisma.companyNameChange.create({
            data: { companyId: company.id, oldName: company.displayName, newName },
          }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'company.name_change.request',
          entityType: 'Company',
          entityId: company.id,
          details: { oldName: company.displayName, newName },
        },
      }),
    ]);
  }

  /** Yönetim listesi: status=PENDING ile onay bekleyenler (en eski önce) */
  async listForAdmin({ status, q, page, limit }: { status?: VerificationStatus; q?: string; page: number; limit: number }) {
    const where: Prisma.CompanyNameChangeWhereInput = {
      company: { deletedAt: null },
      ...(status && { status }),
      ...(q && {
        OR: [
          { oldName: { contains: q } },
          { newName: { contains: q } },
          { company: { displayName: { contains: q } } },
          { company: { legalName: { contains: q } } },
          { company: { taxNumber: { contains: q } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyNameChange.findMany({
        where,
        orderBy: { createdAt: status === VerificationStatus.PENDING ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: ADMIN_VIEW,
      }),
      this.prisma.companyNameChange.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Firma inceleme ekranı: son değişiklikler, en yeni önce */
  historyFor(companyId: string) {
    return this.prisma.companyNameChange.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, oldName: true, newName: true, status: true, reviewNote: true, createdAt: true, reviewedAt: true },
    });
  }

  pendingCount() {
    return this.prisma.companyNameChange.count({
      where: { status: VerificationStatus.PENDING, company: { deletedAt: null } },
    });
  }

  /** Onayda yeni ad hemen yayına girer; retle eski ad kalır, gerekçe firma panelinde görünür */
  async review(adminId: string, id: string, decision: 'VERIFIED' | 'REJECTED', note?: string) {
    const change = await this.prisma.companyNameChange.findFirst({ where: { id, company: { deletedAt: null } } });
    if (!change) throw new NotFoundException('Ad değişikliği bulunamadı');
    if (change.status !== VerificationStatus.PENDING) throw new ConflictException('Bu ad değişikliği için zaten karar verilmiş');

    const approve = decision === VerificationStatus.VERIFIED;
    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.companyNameChange.update({
        where: { id },
        data: { status: decision, reviewedAt: now, reviewNote: approve ? null : (note ?? null) },
        include: ADMIN_VIEW,
      }),
      ...(approve
        ? [this.prisma.company.update({ where: { id: change.companyId }, data: { displayName: change.newName } })]
        : []),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: approve ? 'company.name_change.approve' : 'company.name_change.reject',
          entityType: 'Company',
          entityId: change.companyId,
          details: { oldName: change.oldName, newName: change.newName, ...(note && !approve ? { note } : {}) },
        },
      }),
    ]);
    this.events.emit('company.name_change_reviewed', { changeId: id });
    return approve ? { ...updated, company: { ...updated.company, displayName: change.newName } } : updated;
  }

  private async approvedDates(companyId: string) {
    const rows = await this.prisma.companyNameChange.findMany({
      where: { companyId, status: VerificationStatus.VERIFIED, reviewedAt: { gt: nameChangeWindowStart() } },
      select: { reviewedAt: true },
    });
    return rows.map((r) => r.reviewedAt!);
  }
}
