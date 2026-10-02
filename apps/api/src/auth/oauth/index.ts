import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AppleProvider, type AppleConfig } from './apple.provider.js';
import { GoogleProvider } from './google.provider.js';
import type { OAuthProvider } from './provider.js';
import { TestProvider } from './test.provider.js';

const logger = new Logger('OAuthProviders');

/** Anahtarları tanımlı sağlayıcılar. Hiçbiri yoksa giriş ve kayıt sayfalarında düğme görünmez. */
export function createOAuthProviders(config: ConfigService): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  const get = (name: string) => config.get<string>(name)?.trim() || undefined;

  const googleId = get('GOOGLE_CLIENT_ID');
  const googleSecret = get('GOOGLE_CLIENT_SECRET');
  if (googleId && googleSecret) providers.push(new GoogleProvider({ clientId: googleId, clientSecret: googleSecret }));
  else if (googleId || googleSecret) logger.error('Google girişi için GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET birlikte gerekli');

  const apple = { clientId: get('APPLE_CLIENT_ID'), teamId: get('APPLE_TEAM_ID'), keyId: get('APPLE_KEY_ID'), privateKey: get('APPLE_PRIVATE_KEY') };
  const appleSet = Object.values(apple).filter(Boolean).length;
  if (appleSet === 4) {
    try {
      providers.push(new AppleProvider(apple as AppleConfig));
    } catch {
      logger.error('APPLE_PRIVATE_KEY okunamadı (.p8 dosyasının tamamı olmalı). Apple girişi kapalı.');
    }
  } else if (appleSet > 0) {
    logger.error('Apple girişi için APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID ve APPLE_PRIVATE_KEY gerekli');
  }

  if (get('OAUTH_TEST_PROVIDER') === '1' && config.get('NODE_ENV') !== 'production') {
    logger.warn('OAUTH_TEST_PROVIDER açık: sahte "test" girişi kullanılabilir');
    providers.push(new TestProvider());
  }
  return providers;
}
