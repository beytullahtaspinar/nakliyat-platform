import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { User } from '../generated/prisma/client.js';
import { UserRole, UserStatus } from '../generated/prisma/enums.js';
import { normalizeTrMobile } from '../common/utils/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VerificationService } from '../verification/verification.service.js';
import type { AuthResponseDto, AuthTokensDto, AuthUserDto } from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  /** Yönetici firmanın panelini görüntülüyorsa yöneticinin kimliği */
  imp?: string;
}

export const BCRYPT_ROUNDS = 12;
/** Şifresi olmayan (yalnızca Google/Apple ile giren) hesaplar. Geçerli bir bcrypt özeti değildir. */
export const OAUTH_ONLY_PASSWORD = '!';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly verification: VerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const phone = this.requirePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
      select: { phone: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.phone === phone
          ? 'Bu telefon numarası zaten kayıtlı'
          : 'Bu e-posta adresi zaten kayıtlı',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        role: dto.role,
        fullName: dto.fullName.trim(),
        phone,
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });
    // İlk doğrulama kodu kayıtla birlikte gider; gönderilemezse kullanıcı doğrulama ekranından yeniden ister
    if (email) {
      await this.verification.sendEmailCode(user.id).catch(() => this.logger.warn('Kayıt sonrası e-posta kodu gönderilemedi'));
    }
    return this.signIn(user);
  }

  /** Oturum açar: yeni erişim ve yenileme anahtarı (Google/Apple girişi de bunu kullanır) */
  async signIn(user: User): Promise<AuthResponseDto> {
    if (user.deletedAt) throw new UnauthorizedException('Bu hesap silinmiş');
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Hesabınız askıya alınmış');
    return { user: this.toAuthUser(user), ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const phone = normalizeTrMobile(dto.phone);
    const user = phone
      ? await this.prisma.user.findUnique({ where: { phone } })
      : null;
    if (user && !user.deletedAt && user.passwordHash === OAUTH_ONLY_PASSWORD) {
      throw new UnauthorizedException('Bu hesap Google veya Apple ile açıldı. Giriş sayfasındaki düğmeyle devam et.');
    }
    const valid = user && !user.deletedAt && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Telefon numarası veya şifre hatalı');
    }
    return this.signIn(user);
  }

  /** Yenileme anahtarını tek kullanımlık olarak döndürür (rotation). */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Oturum süresi dolmuş, tekrar giriş yapın');
    }
    if (stored.revokedAt) {
      // Daha önce kullanılmış anahtar tekrar geldiyse çalınmış olabilir: tüm oturumları kapat.
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Oturum süresi dolmuş, tekrar giriş yapın');
    }
    if (stored.user.status !== UserStatus.ACTIVE || stored.user.deletedAt) {
      throw new UnauthorizedException('Hesabınız askıya alınmış');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }

  private async issueTokens(user: Pick<User, 'id' | 'role'>): Promise<AuthTokensDto> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return { accessToken: await this.jwt.signAsync(payload), refreshToken };
  }

  private async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      phoneVerified: user.phoneVerifiedAt !== null,
      emailVerified: user.emailVerifiedAt !== null,
      verified: this.verification.isComplete(user),
    };
  }

  private requirePhone(input: string): string {
    const phone = normalizeTrMobile(input);
    if (!phone) throw new BadRequestException('Geçerli bir cep telefonu numarası girin');
    return phone;
  }
}
