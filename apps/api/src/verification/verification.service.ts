import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEvents } from '../events/domain-events.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { RequestStatus, VerificationChannel } from '../generated/prisma/enums.js';
import { ErrorReporterService } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { VerificationStatusDto } from './dto/verification.dto.js';
import { EMAIL_CODE_SENDER, PHONE_CODE_SENDER, type CodeSender } from './senders/code-sender.js';

export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_INTERVAL_MS = 60_000;
export const MAX_ATTEMPTS = 5;
/** Kullanıcı başına, kanal başına 24 saatte en fazla bu kadar kod (SMS maliyeti ve kötüye kullanım) */
export const DAILY_LIMIT = 10;

type VerifiableUser = Pick<User, 'emailVerifiedAt' | 'phoneVerifiedAt'>;

/**
 * E-posta ve telefon doğrulaması: 6 haneli, 10 dakika geçerli, tek kullanımlık kod.
 * 5 hatalı denemede kod geçersiz olur; 60 saniyede bir yeni kod istenebilir.
 * Kodun kendisi saklanmaz, HMAC özeti tutulur. Ayrıntı: docs/dogrulama.md
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly secret: string;
  /** Yalnızca geliştirme ve tarayıcı testleri için sabit kod; canlıda yok sayılır */
  private readonly testCode?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly errors: ErrorReporterService,
    config: ConfigService,
    @Inject(EMAIL_CODE_SENDER) private readonly emailSender: CodeSender | null,
    @Inject(PHONE_CODE_SENDER) private readonly phoneSender: CodeSender | null,
  ) {
    this.secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const testCode = config.get<string>('VERIFICATION_TEST_CODE');
    if (testCode && /^\d{6}$/.test(testCode) && config.get('NODE_ENV') !== 'production') {
      this.testCode = testCode;
      this.logger.warn('VERIFICATION_TEST_CODE açık: tüm doğrulama kodları sabit');
    }
  }

  get phoneRequired(): boolean {
    return this.phoneSender !== null;
  }

  /** Talep yayını, teklif verme ve teklif kabulü için gereken doğrulamalar tamam mı? */
  isComplete(user: VerifiableUser): boolean {
    return user.emailVerifiedAt !== null && (!this.phoneRequired || user.phoneVerifiedAt !== null);
  }

  async isUserComplete(userId: string): Promise<boolean> {
    return this.isComplete(await this.findUser(userId));
  }

  async assertComplete(userId: string): Promise<void> {
    if (!(await this.isUserComplete(userId))) {
      throw new ForbiddenException(
        this.phoneRequired
          ? 'Devam etmek için e-posta adresini ve telefon numaranı doğrula.'
          : 'Devam etmek için e-posta adresini doğrula.',
      );
    }
  }

  async status(userId: string): Promise<VerificationStatusDto> {
    const user = await this.findUser(userId);
    const [email, phone] = await Promise.all([
      this.latestCode(userId, VerificationChannel.EMAIL),
      this.latestCode(userId, VerificationChannel.PHONE),
    ]);
    const now = Date.now();
    const usable = (c: typeof email) => c && !c.consumedAt && c.expiresAt.getTime() > now && c.attempts < MAX_ATTEMPTS;
    const resendAt = (c: typeof email) => {
      const at = c ? c.createdAt.getTime() + RESEND_INTERVAL_MS : 0;
      return at > now ? new Date(at).toISOString() : null;
    };
    return {
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      emailCodeSentTo: usable(email) ? email!.target : null,
      emailResendAt: resendAt(email),
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt !== null,
      phoneRequired: this.phoneRequired,
      phoneChannel: !this.phoneSender ? null : this.phoneSender.provider === 'whatsapp' ? 'whatsapp' : 'sms',
      phoneCodeSent: Boolean(usable(phone) && phone!.target === user.phone),
      phoneResendAt: resendAt(phone),
      complete: this.isComplete(user),
    };
  }

  /** E-posta kodu gönderir. newEmail verilirse kod o adrese gider; adres onaydan sonra hesaba yazılır. */
  async sendEmailCode(userId: string, newEmail?: string): Promise<VerificationStatusDto> {
    const user = await this.findUser(userId);
    const target = newEmail ?? user.email;
    if (!target) throw new BadRequestException('Doğrulama kodu için e-posta adresini yaz');
    if (target === user.email && user.emailVerifiedAt) {
      throw new ConflictException('Bu e-posta adresi zaten doğrulanmış');
    }
    if (target !== user.email) await this.assertEmailFree(userId, target);
    await this.issue(user, VerificationChannel.EMAIL, target, this.emailSender);
    return this.status(userId);
  }

  async sendPhoneCode(userId: string): Promise<VerificationStatusDto> {
    const user = await this.findUser(userId);
    if (!this.phoneSender) throw new ServiceUnavailableException('Telefon doğrulaması henüz açık değil');
    if (user.phoneVerifiedAt) throw new ConflictException('Telefon numaran zaten doğrulanmış');
    await this.issue(user, VerificationChannel.PHONE, user.phone, this.phoneSender);
    return this.status(userId);
  }

  async confirm(userId: string, channel: VerificationChannel, code: string): Promise<VerificationStatusDto> {
    const user = await this.findUser(userId);
    const wasComplete = this.isComplete(user);
    const latest = await this.latestCode(userId, channel);
    const now = new Date();
    if (!latest || latest.consumedAt || latest.expiresAt <= now) {
      throw new BadRequestException('Kodun süresi dolmuş. Yeni kod iste.');
    }
    if (channel === VerificationChannel.PHONE && latest.target !== user.phone) {
      throw new BadRequestException('Telefon numaran değişmiş. Yeni kod iste.');
    }

    // Deneme hakkı karşılaştırmadan önce düşülür: eşzamanlı isteklerle 5 sınırı aşılamaz
    const counted = await this.prisma.verificationCode.updateMany({
      where: { id: latest.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count !== 1) {
      throw new BadRequestException('Çok fazla hatalı deneme yapıldı. Yeni kod iste.');
    }
    if (!this.matches(latest.id, code, latest.codeHash)) {
      const left = MAX_ATTEMPTS - latest.attempts - 1;
      throw new BadRequestException(
        left > 0 ? `Kod hatalı. ${left} deneme hakkın kaldı.` : 'Çok fazla hatalı deneme yapıldı. Yeni kod iste.',
      );
    }
    const consumed = await this.prisma.verificationCode.updateMany({
      where: { id: latest.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new BadRequestException('Bu kod zaten kullanıldı. Yeni kod iste.');

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data:
          channel === VerificationChannel.EMAIL
            ? { email: latest.target, emailVerifiedAt: now }
            : { phoneVerifiedAt: now },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu e-posta adresi başka bir hesapta kayıtlı');
      }
      throw e;
    }

    const status = await this.status(userId);
    if (status.complete && !wasComplete) await this.publishDrafts(userId);
    return status;
  }

  /**
   * Doğrulama bitmeden açılan talepler taslak (DRAFT) kalır ve firmalara gösterilmez.
   * Doğrulama tamamlanınca yayına alınır; firmalara "yeni talep" bildirimi o zaman gider.
   */
  private async publishDrafts(customerId: string) {
    const drafts = await this.prisma.movingRequest.findMany({
      where: { customerId, status: RequestStatus.DRAFT, deletedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    for (const { id } of drafts) {
      const { count } = await this.prisma.movingRequest.updateMany({
        where: { id, status: RequestStatus.DRAFT },
        data: { status: RequestStatus.OPEN, publishedAt: new Date() },
      });
      if (count === 1) this.events.emit('request.created', { requestId: id });
    }
  }

  private async issue(
    user: Pick<User, 'id' | 'fullName'>,
    channel: VerificationChannel,
    target: string,
    sender: CodeSender | null,
  ) {
    if (!sender) {
      throw new ServiceUnavailableException('Doğrulama kodu şu an gönderilemiyor, lütfen biraz sonra tekrar dene.');
    }
    const now = Date.now();
    const latest = await this.latestCode(user.id, channel);
    if (latest && latest.createdAt.getTime() + RESEND_INTERVAL_MS > now) {
      const wait = Math.ceil((latest.createdAt.getTime() + RESEND_INTERVAL_MS - now) / 1000);
      throw new HttpException(`Yeni kod için ${wait} saniye bekle.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const today = await this.prisma.verificationCode.count({
      where: { userId: user.id, channel, createdAt: { gt: new Date(now - 24 * 60 * 60_000) } },
    });
    if (today >= DAILY_LIMIT) {
      throw new HttpException('Bugün çok fazla kod istendi. Yarın tekrar dene.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.testCode ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Önceki kodlar geçersiz: yalnızca en son gönderilen kod kullanılabilir
    await this.prisma.verificationCode.updateMany({
      where: { userId: user.id, channel, consumedAt: null },
      data: { consumedAt: new Date(now) },
    });
    const id = cuidLike();
    await this.prisma.verificationCode.create({
      data: { id, userId: user.id, channel, target, codeHash: this.hash(id, code), expiresAt: new Date(now + CODE_TTL_MS) },
    });

    try {
      await sender.send({ address: target, fullName: user.fullName }, code);
    } catch (error) {
      await this.prisma.verificationCode.delete({ where: { id } }).catch(() => undefined);
      this.logger.error(`${sender.provider} doğrulama kodu gönderilemedi`);
      this.errors.capture(error, { tags: { provider: sender.provider } });
      throw new ServiceUnavailableException('Doğrulama kodu gönderilemedi, lütfen biraz sonra tekrar dene.');
    }
  }

  private hash(id: string, code: string) {
    return createHmac('sha256', this.secret).update(`${id}:${code}`).digest('hex');
  }

  private matches(id: string, code: string, expected: string) {
    const actual = Buffer.from(this.hash(id, code), 'hex');
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }

  private latestCode(userId: string, channel: VerificationChannel) {
    return this.prisma.verificationCode.findFirst({ where: { userId, channel }, orderBy: { createdAt: 'desc' } });
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new ForbiddenException();
    return user;
  }

  private async assertEmailFree(userId: string, email: string) {
    const taken = await this.prisma.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ConflictException('Bu e-posta adresi başka bir hesapta kayıtlı');
  }
}

/** Kod satırının kimliği HMAC'e girer; kimlik önceden bilinsin diye burada üretilir. */
function cuidLike() {
  return `v${Date.now().toString(36)}${randomInt(0, 2 ** 40).toString(36)}`;
}
