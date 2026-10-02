import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AccessTokenPayload } from '../../auth/auth.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Oturum açmanız gerekiyor');
    }
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Oturum süresi dolmuş veya geçersiz');
    }
    // Rol ve hesap durumu anahtardan değil veritabanından okunur: yönetici rolü değiştirdiğinde
    // veya hesabı askıya aldığında, açık oturumlar eski yetkiyle çalışmaya devam etmesin.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Oturum süresi dolmuş veya geçersiz');
    }
    if (payload.imp) {
      // Firma görüntüleme anahtarı: yönetici o arada yetkisini kaybettiyse anahtar da geçersiz
      const admin = await this.prisma.user.findUnique({
        where: { id: payload.imp },
        select: { role: true, status: true, deletedAt: true },
      });
      if (!admin || admin.deletedAt || admin.status !== UserStatus.ACTIVE || admin.role !== UserRole.ADMIN) {
        throw new UnauthorizedException('Oturum süresi dolmuş veya geçersiz');
      }
    }
    request.user = { id: payload.sub, role: user.role, ...(payload.imp && { impersonatorId: payload.imp }) };
    return true;
  }
}
