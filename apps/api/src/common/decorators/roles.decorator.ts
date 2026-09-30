import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Uç noktayı yalnızca verilen rollere açar. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
