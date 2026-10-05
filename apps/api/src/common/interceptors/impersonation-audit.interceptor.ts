import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { from, mergeMap, type Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Yönetici firma panelini ya da müşteri hesabını sahibinin gözünden kullanırken yaptığı her değişikliği
 * (okuma hariç) yöneticinin adıyla firmanın ya da müşterinin geçmişine yazar. Kayıt yazılamazsa istek
 * yine de tamamlanır.
 */
@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ImpersonationAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user?.impersonatorId || READ_METHODS.has(request.method)) return next.handle();

    return next.handle().pipe(
      mergeMap((body) => from(this.record(user, request).then(() => body))),
    );
  }

  private async record(user: AuthUser, request: Request) {
    try {
      const details = { method: request.method, path: request.originalUrl.split('?')[0] };
      if (user.role === UserRole.CUSTOMER) {
        await this.prisma.auditLog.create({
          data: { actorId: user.impersonatorId!, action: 'user.impersonate.action', entityType: 'User', entityId: user.id, details },
        });
        return;
      }
      const company = await this.prisma.company.findUnique({ where: { ownerId: user.id }, select: { id: true } });
      await this.prisma.auditLog.create({
        data: {
          actorId: user.impersonatorId!,
          action: 'company.impersonate.action',
          entityType: company ? 'Company' : 'User',
          entityId: company?.id ?? user.id,
          details,
        },
      });
    } catch (err) {
      this.logger.error(`Yönetici görüntüleme kaydı yazılamadı: ${(err as Error).message}`);
    }
  }
}
