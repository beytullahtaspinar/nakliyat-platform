import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client.js';
import { IdentityProvider } from '../../generated/prisma/enums.js';
import { ErrorReporterService } from '../../observability/error-reporter.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeTrMobile } from '../../common/utils/phone.js';
import { VerificationService } from '../../verification/verification.service.js';
import { AuthService, OAUTH_ONLY_PASSWORD } from '../auth.service.js';
import type { AuthResponseDto } from '../dto/auth-response.dto.js';
import { consentData } from '../dto/consent.js';
import type { OAuthCallbackDto, OAuthCompleteDto, OAuthStartDto } from './oauth.dto.js';
import { OAUTH_PROVIDERS, type OAuthProfile, type OAuthProvider } from './provider.js';

/** Sağlayıcıdan dönen ama henüz hesabı olmayan kişi: telefon ve rol sorulana kadar bu belirteçte bekler */
interface SignupClaims {
  provider: IdentityProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export type OAuthResult =
  | ({ status: 'signed_in' } & AuthResponseDto)
  | { status: 'signup_required'; signupToken: string; profile: { fullName: string | null; email: string | null } };

const SIGNUP_TTL = '20m';
const PROVIDER_NAMES: Record<IdentityProvider, string> = { GOOGLE: 'Google', APPLE: 'Apple' };

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly webUrl: string;
  private readonly signupSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
    private readonly errors: ErrorReporterService,
    config: ConfigService,
    @Inject(OAUTH_PROVIDERS) private readonly providers: OAuthProvider[],
  ) {
    this.webUrl = (config.get<string>('WEB_URL') ?? 'https://evdenevenakliyat.app').replace(/\/$/, '');
    // Erişim anahtarından farklı gizli anahtar: kayıt belirteci oturum açmak için kullanılamaz
    this.signupSecret = `${config.getOrThrow<string>('JWT_ACCESS_SECRET')}:oauth-signup`;
  }

  /** Düğmesi gösterilecek sağlayıcılar (testte kullanılan "test" hariç) */
  enabledProviders(): string[] {
    return this.providers.map((p) => p.id).filter((id) => id !== 'test');
  }

  /** Dönüş adresi her zaman WEB_URL'den kurulur; istemciden alınmaz */
  redirectUri(provider: OAuthProvider) {
    return `${this.webUrl}/api/giris/${provider.id}/donus`;
  }

  start(providerId: string, dto: OAuthStartDto) {
    const provider = this.provider(providerId);
    return { url: provider.authorizationUrl({ ...dto, redirectUri: this.redirectUri(provider) }) };
  }

  async callback(providerId: string, dto: OAuthCallbackDto): Promise<OAuthResult> {
    const provider = this.provider(providerId);
    let profile: OAuthProfile;
    try {
      profile = await provider.exchange({ ...dto, redirectUri: this.redirectUri(provider) });
    } catch (error) {
      this.logger.warn(`${provider.id} girişi doğrulanamadı`);
      this.errors.capture(error, { tags: { provider: provider.id } });
      throw new UnauthorizedException(`${PROVIDER_NAMES[provider.identity]} ile giriş yapılamadı, lütfen tekrar dene.`);
    }

    const linked = await this.prisma.userIdentity.findUnique({
      where: { provider_subject: { provider: provider.identity, subject: profile.subject } },
      include: { user: true },
    });
    if (linked) return { status: 'signed_in', ...(await this.auth.signIn(linked.user)) };

    if (profile.email && profile.emailVerified) {
      const existing = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (existing && !existing.deletedAt) {
        // Adresin sahibi olduğu, hem sağlayıcıda hem bizde doğrulanmışsa hesaplar birleşir.
        // Bizde doğrulanmamışsa adresi başkası yazmış olabilir: bağlanmaz.
        if (!existing.emailVerifiedAt) {
          throw new ConflictException(
            'Bu e-posta adresiyle açılmış bir hesap var. Telefon numaran ve şifrenle giriş yap.',
          );
        }
        await this.prisma.userIdentity.create({
          data: { userId: existing.id, provider: provider.identity, subject: profile.subject, email: profile.email },
        });
        return { status: 'signed_in', ...(await this.auth.signIn(existing)) };
      }
    }

    const claims: SignupClaims = { provider: provider.identity, ...profile };
    const signupToken = await this.jwt.signAsync(claims, { secret: this.signupSecret, expiresIn: SIGNUP_TTL });
    return { status: 'signup_required', signupToken, profile: { fullName: profile.name, email: profile.email } };
  }

  /** Kayıt tamamlama ekranı için: sağlayıcıdan gelen ad ve e-posta */
  async pending(signupToken: string) {
    const claims = await this.readSignup(signupToken);
    return { provider: claims.provider, fullName: claims.name, email: claims.email };
  }

  /** Telefon ve rol alınır, hesap açılır. Sağlayıcının doğruladığı e-posta doğrulanmış sayılır. */
  async complete(dto: OAuthCompleteDto): Promise<AuthResponseDto> {
    const claims = await this.readSignup(dto.signupToken);
    const phone = normalizeTrMobile(dto.phone);
    if (!phone) throw new BadRequestException('Geçerli bir cep telefonu numarası girin');

    // Aynı belirteçle ikinci kez gelinirse (çift tıklama) hesap zaten açılmıştır
    const linked = await this.prisma.userIdentity.findUnique({
      where: { provider_subject: { provider: claims.provider, subject: claims.subject } },
      include: { user: true },
    });
    if (linked) return this.auth.signIn(linked.user);

    if (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
      throw new ConflictException('Bu telefon numarası kayıtlı. Telefon numaran ve şifrenle giriş yap.');
    }
    const emailTaken = claims.email
      ? await this.prisma.user.findUnique({ where: { email: claims.email }, select: { id: true } })
      : null;
    if (emailTaken) {
      throw new ConflictException('Bu e-posta adresiyle açılmış bir hesap var. Telefon numaran ve şifrenle giriş yap.');
    }

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          role: dto.role,
          fullName: dto.fullName.trim(),
          phone,
          email: claims.email,
          emailVerifiedAt: claims.email && claims.emailVerified ? new Date() : null,
          passwordHash: OAUTH_ONLY_PASSWORD,
          ...consentData(dto),
          identities: { create: { provider: claims.provider, subject: claims.subject, email: claims.email } },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu bilgilerle açılmış bir hesap var. Giriş yapmayı dene.');
      }
      throw e;
    }
    if (user.email && !user.emailVerifiedAt) {
      await this.verification.sendEmailCode(user.id).catch(() => this.logger.warn('Kayıt sonrası e-posta kodu gönderilemedi'));
    }
    return this.auth.signIn(user);
  }

  private async readSignup(token: string): Promise<SignupClaims> {
    try {
      return await this.jwt.verifyAsync<SignupClaims>(token, { secret: this.signupSecret });
    } catch {
      throw new UnauthorizedException('Kayıt süresi doldu. Google veya Apple ile yeniden devam et.');
    }
  }

  private provider(id: string): OAuthProvider {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) {
      if (id === 'google' || id === 'apple') throw new ServiceUnavailableException('Bu giriş yöntemi henüz açık değil');
      throw new NotFoundException();
    }
    return provider;
  }
}
