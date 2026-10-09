import { BadRequestException, Body, Controller, Delete, ForbiddenException, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import bcrypt from 'bcryptjs';
import { OAUTH_ONLY_PASSWORD } from '../auth/auth.service.js';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { DeleteAccountDto } from './delete-account.dto.js';

// Şifre denemesine karşı: giriş uçlarıyla aynı sınır
const DELETE_THROTTLE = { default: { limit: Number(process.env.AUTH_RATE_LIMIT) || 10, ttl: 60_000 } };

@ApiTags('Kimlik doğrulama')
@ApiBearerAuth()
@Controller('auth')
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deletion: AccountDeletionService,
  ) {}

  /**
   * Kullanıcı kendi hesabını siler (KVKK, App Store ve Google Play kuralı: uygulama içinden silinebilmeli).
   * Şifresi olan hesap şifresini yeniden girer; yalnızca Google/Apple ile açılmış hesapta oturum yeterlidir.
   * Silme işlemi yönetici silmesiyle aynıdır; planlanmış taşıma işi varsa iş bitene kadar silinemez.
   */
  @Throttle(DELETE_THROTTLE)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() current: AuthUser, @Body() dto: DeleteAccountDto) {
    if (current.impersonatorId) throw new ForbiddenException('Yönetici görünümündeyken hesap silinemez');
    if (current.role === UserRole.ADMIN) throw new ForbiddenException('Yönetici hesapları buradan silinemez');

    const user = await this.prisma.user.findFirst({
      where: { id: current.id, deletedAt: null },
      include: { company: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Hesap bulunamadı');
    if (user.passwordHash !== OAUTH_ONLY_PASSWORD) {
      if (!dto.password || !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new BadRequestException('Şifre yanlış');
      }
    }

    const account = { id: user.id, role: user.role, companyId: user.company?.id };
    await this.deletion.assertDeletable(
      account,
      'Planlanmış bir taşıma işin var. İş tamamlanmadan ya da iptal edilmeden hesabın silinemez.',
    );
    await this.deletion.delete(account, user.id, 'user.self_delete');
  }
}
