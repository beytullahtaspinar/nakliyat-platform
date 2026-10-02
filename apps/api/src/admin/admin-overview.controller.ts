import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { BookingStatus, RequestStatus, UserRole, VerificationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Admin: özet')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/summary')
export class AdminOverviewController {
  constructor(private readonly prisma: PrismaService) {}

  /** Yönetim ekranının ilk sayfası: bekleyen işler ve toplamlar */
  @Get()
  async summary() {
    const [companies, requests, users, scheduledBookings, pendingDocuments] = await this.prisma.$transaction([
      this.prisma.company.groupBy({
        by: ['verificationStatus'],
        where: { deletedAt: null },
        orderBy: { verificationStatus: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.movingRequest.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        orderBy: { role: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.booking.count({ where: { status: BookingStatus.SCHEDULED } }),
      this.prisma.companyDocument.count({
        where: { status: VerificationStatus.PENDING, company: { deletedAt: null } },
      }),
    ]);
    const count = <K extends string>(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], key: string) =>
      Object.fromEntries(rows.map((r) => [r[key] as K, r._count._all])) as Partial<Record<K, number>>;
    const byStatus = count(companies, 'verificationStatus');
    const byRequest = count<RequestStatus>(requests, 'status');
    const byRole = count<UserRole>(users, 'role');
    return {
      companies: { pending: byStatus.PENDING ?? 0, verified: byStatus.VERIFIED ?? 0, rejected: byStatus.REJECTED ?? 0 },
      requests: { open: byRequest.OPEN ?? 0, booked: byRequest.BOOKED ?? 0, total: sum(byRequest) },
      users: { customers: byRole.CUSTOMER ?? 0, companies: byRole.COMPANY ?? 0, total: sum(byRole) },
      bookings: { scheduled: scheduledBookings },
      documents: { pending: pendingDocuments },
    };
  }
}

const sum = (counts: Partial<Record<string, number>>) =>
  Object.values(counts).reduce<number>((total, n) => total + (n ?? 0), 0);
