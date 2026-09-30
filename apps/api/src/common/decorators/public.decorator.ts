import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Uç noktayı giriş yapmadan erişilebilir yapar. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
