import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
