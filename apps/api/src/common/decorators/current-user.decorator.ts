import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  role: UserRole;
  /** Firma paneline ya da müşteri hesabına yönetici olarak geçildiyse yöneticinin kimliği */
  impersonatorId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
