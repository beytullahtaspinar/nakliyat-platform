import { ConflictException, Injectable } from '@nestjs/common';
import { BookingStatus, QuoteStatus, RequestStatus, UserStatus } from '../generated/prisma/enums.js';
import { CreditsService } from '../credits/credits.service.js';
import { CompanyDocumentsService } from '../media/company-documents.service.js';
import { CompanyShowcaseService } from '../media/company-showcase.service.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AccountToDelete {
  id: string;
  role: string;
  companyId?: string | null;
}

/**
 * Hesap silme: yönetici panelden (DELETE /admin/users/:id) ya da kullanıcı kendisi (DELETE /auth/me) siler.
 * Talep, teklif, iş ve karar geçmişi kayıtları bozulmasın diye satır silinmez;
 * ad, telefon, e-posta ve şifre geri dönülemez şekilde silinir, hesap bir daha açılamaz.
 * Açık talepler iptal edilir, talep fotoğraf/videoları silinir, firmanın bekleyen teklifleri geri çekilir ve firma listelerden kalkar.
 * Planlanmış işi olan hesap silinmez (karşı taraf ortada kalmasın).
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly documents: CompanyDocumentsService,
    private readonly showcase: CompanyShowcaseService,
    private readonly credits: CreditsService,
  ) {}

  /** Planlanmış taşıma işi varsa ConflictException; mesajı çağıran kendi kitlesine göre verir */
  async assertDeletable(user: AccountToDelete, message: string) {
    const scheduled = await this.prisma.booking.count({
      where: {
        status: BookingStatus.SCHEDULED,
        OR: [{ request: { customerId: user.id } }, ...(user.companyId ? [{ companyId: user.companyId }] : [])],
      },
    });
    if (scheduled) throw new ConflictException(message);
  }

  /** actorId: silen kişi (yönetici ya da kullanıcının kendisi); denetim kaydına yazılır */
  async delete(user: AccountToDelete, actorId: string, action: 'user.delete' | 'user.self_delete') {
    const { id, companyId } = user;
    const now = new Date();
    // İptal edilecek açık talepler: teklif veren firmaların kredisi iade edilir
    const openRequests = await this.prisma.movingRequest.findMany({
      where: { customerId: id, status: { in: [RequestStatus.DRAFT, RequestStatus.OPEN] } },
      select: { id: true },
    });
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
      this.prisma.mobilePushToken.deleteMany({ where: { userId: id } }),
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
        data: { actorId, action, entityType: 'User', entityId: id, details: { role: user.role } },
      }),
    ]);
    await this.credits.refundCancelledRequests(openRequests.map((r) => r.id));
    // Talep fotoğraf/videoları da kişisel veri: kayıt silindikten sonra depodan da kaldırılır
    await this.media.deleteForCustomer(id);
    if (companyId) {
      await this.documents.deleteForCompany(companyId);
      await this.showcase.deleteForCompany(companyId);
    }
  }
}
