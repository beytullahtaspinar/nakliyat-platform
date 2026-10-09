import type { UserRole } from '@nakliyat/api-client';
import Constants from 'expo-constants';

export type AppVariant = 'firma' | 'musteri';

/** Hangi uygulama olarak derlendiği (app.config.ts → extra.variant) */
export const variant: AppVariant = Constants.expoConfig?.extra?.variant === 'firma' ? 'firma' : 'musteri';

/** Bu uygulamaya hangi rol girebilir; giriş aynı, rol farklıysa diğer uygulamaya yönlendirilir. */
export const allowedRole: UserRole = variant === 'firma' ? 'COMPANY' : 'CUSTOMER';

export const WEB_ORIGIN = 'https://evdenevenakliyat.app';

export function wrongAppMessage(role: UserRole): string {
  if (role === 'ADMIN') return 'Yönetici hesabıyla mobil uygulamaya girilemez. Yönetim paneli için evdenevenakliyat.app adresini kullan.';
  if (role === 'COMPANY') return 'Bu bir firma hesabı. Firma hesabıyla Evdenevenakliyat Firma uygulamasından giriş yap.';
  return 'Bu bir müşteri hesabı. Müşteri hesabıyla Evdenevenakliyat uygulamasından giriş yap.';
}
