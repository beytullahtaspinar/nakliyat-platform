import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../auth/auth.service.js';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { normalizeTrMobile } from '../common/utils/phone.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BookingStatus, QuoteStatus, RequestStatus, UserRole, UserStatus } from '../generated/prisma/enums.js';
import { CompanyDocumentsService } from '../media/company-documents.service.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminListUsersDto,
  AdminSetPasswordDto,
  AdminUpdateUserDto,
  phoneDigits,
} from './dto/admin-lists.dto.js';

/** Yanıtlarda dönen alanlar. Şifre özeti ve anahtarlar hiç seçilmez. */
const USER_FIELDS = {
  id: true,
  role: true,
  status: true,
  fullName: true,
  phone: true,
  email: true,
  phoneVerifiedAt: true,
  createdAt: true,
  company: { select: { id: true, displayName: true, verificationStatus: true } },
  _count: { select: { requests: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_FIELDS }>;
const toUser = ({ _count, ...u }: UserRow) => ({ ...u, requestCount: _count.requests });

@ApiTags('Admin: kullanıcılar')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly documents: CompanyDocumentsService,
  ) {}

  /** Kullanıcılar, en yenisi önce. */
  @Get()
  async list(@Query() { role, q, page, limit }: AdminListUsersDto) {
    const digits = phoneDigits(q);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(q && {
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: USER_FIELDS,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toUser), total, page, limit };
  }

  /** Düzenleme ekranı: kullanıcı ve yönetimin bu hesapta yaptığı son işlemler */
  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_FIELDS });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const history = await this.prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, details: true, createdAt: true, actor: { select: { fullName: true } } },
    });
    return { ...toUser(user), history };
  }

  /** Ad, telefon, e-posta ve hesap durumu. Askıya alınan hesabın açık oturumları kapatılır. */
  @Patch(':id')
  async update(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    const user = await this.requireUser(id);
    if (id === admin.id && dto.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Kendi hesabını askıya alamazsın');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined && dto.fullName !== user.fullName) data.fullName = dto.fullName;
    if (dto.phone !== undefined) {
      const phone = normalizeTrMobile(dto.phone);
      if (!phone) throw new BadRequestException('Geçerli bir cep telefonu numarası girin');
      if (phone !== user.phone) {
        if (await this.prisma.user.findUnique({ where: { phone } })) {
          throw new ConflictException('Bu telefon numarasıyla kayıtlı başka bir hesap var');
        }
        // Yeni numara henüz doğrulanmadı
        Object.assign(data, { phone, phoneVerifiedAt: null });
      }
    }
    if (dto.email !== undefined) {
      const email = dto.email === '' ? null : dto.email.toLowerCase();
      if (email !== user.email) {
        if (email && (await this.prisma.user.findUnique({ where: { email } }))) {
          throw new ConflictException('Bu e-posta adresiyle kayıtlı başka bir hesap var');
        }
        // Yeni adres henüz doğrulanmadı
        Object.assign(data, { email, emailVerifiedAt: null });
      }
    }
    if (dto.status !== undefined && dto.status !== user.status) data.status = dto.status;

    const changed = Object.keys(data).filter((k) => k !== 'phoneVerifiedAt' && k !== 'emailVerifiedAt');
    if (changed.length === 0) return this.detail(id);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data }),
      ...(data.status === UserStatus.SUSPENDED ? [this.revokeSessions(id)] : []),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'user.update',
          entityType: 'User',
          entityId: id,
          details: { fields: changed, ...(data.status && { status: data.status }) },
        },
      }),
    ]);
    return this.detail(id);
  }

  /**
   * Yönetici yeni şifre belirler; mevcut şifre hiçbir zaman gösterilmez.
   * Kullanıcının tüm açık oturumları kapatılır, yeni şifreyle tekrar giriş yapması gerekir.
   */
  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPassword(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdminSetPasswordDto) {
    await this.requireUser(id);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.revokeSessions(id),
      this.prisma.auditLog.create({
        data: { actorId: admin.id, action: 'user.password_set', entityType: 'User', entityId: id },
      }),
    ]);
  }

  /**
   * Hesabı siler. Talep, teklif, iş ve karar geçmişi kayıtları bozulmasın diye satır silinmez;
   * ad, telefon, e-posta ve şifre geri dönülemez şekilde silinir, hesap bir daha açılamaz.
   * Açık talepler iptal edilir, talep fotoğraf/videoları silinir, firmanın bekleyen teklifleri geri çekilir ve firma listelerden kalkar.
   * Planlanmış işi olan hesap silinmez (karşı taraf ortada kalmasın); o sürede askıya alınabilir.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    if (id === admin.id) throw new BadRequestException('Kendi hesabını silemezsin');
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { company: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    if (user.role === UserRole.ADMIN) throw new BadRequestException('Yönetici hesapları panelden silinemez');

    const companyId = user.company?.id;
    const scheduled = await this.prisma.booking.count({
      where: {
        status: BookingStatus.SCHEDULED,
        OR: [{ request: { customerId: id } }, ...(companyId ? [{ companyId }] : [])],
      },
    });
    if (scheduled) {
      throw new ConflictException('Bu hesabın planlanmış bir taşıma işi var, iş bitmeden silinemez. Şimdilik hesabı askıya alabilirsin.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: now,
          status: UserStatus.SUSPENDED,
          fullName: 'Silinmiş kullanıcı',
          phone: `silindi-${id}`,
          phoneVerifiedAt: null,
          email: null,
          // bcrypt özeti olmadığı için hiçbir şifre eşleşmez
          passwordHash: '!',
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      // Telefonlarına artık bildirim gitmesin
      this.prisma.pushSubscription.deleteMany({ where: { userId: id } }),
      // Google/Apple bağlantısı kişisel veridir; silinen hesaba o yolla yeniden girilemez
      this.prisma.userIdentity.deleteMany({ where: { userId: id } }),
      // Yazdığı mesajlar da kişisel veri: konuşmada yerleri kalır, içerikleri silinir
      this.prisma.message.updateMany({ where: { senderId: id }, data: { body: '' } }),
      // Yorum metni de kişisel veri olabilir: puan firmanın ortalamasında kalır, metin silinir
      this.prisma.review.updateMany({ where: { customerId: id }, data: { comment: null } }),
      this.prisma.movingRequest.updateMany({
        where: { customerId: id, status: { in: [RequestStatus.DRAFT, RequestStatus.OPEN] } },
        data: { status: RequestStatus.CANCELLED },
      }),
      ...(companyId
        ? [
            this.prisma.quote.updateMany({
              where: { companyId, status: QuoteStatus.PENDING },
              data: { status: QuoteStatus.WITHDRAWN },
            }),
            // Vergi no boşa çıkar: firma ileride yeniden kayıt olabilsin
            this.prisma.company.update({
              where: { id: companyId },
              data: { deletedAt: now, taxNumber: `silindi-${companyId}` },
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: { actorId: admin.id, action: 'user.delete', entityType: 'User', entityId: id, details: { role: user.role } },
      }),
    ]);
    // Talep fotoğraf/videoları da kişisel veri: kayıt silindikten sonra depodan da kaldırılır
    await this.media.deleteForCustomer(id);
    if (companyId) await this.documents.deleteForCompany(companyId);
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  private revokeSessions(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
