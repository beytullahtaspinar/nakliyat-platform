import { createApiClient, DEFAULT_API_ORIGIN, type AuthTokens, type TokenStore } from '@nakliyat/api-client';
import * as SecureStore from 'expo-secure-store';

const KEY = 'nk_oturum';

/** Anahtarlar cihazın güvenli deposunda (iOS Keychain, Android Keystore) tutulur. */
const secureTokens: TokenStore = {
  async get() {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(KEY);
  },
};

let onExpired: (() => void) | undefined;

/** Oturum düşünce (yenileme anahtarı reddedildi) giriş ekranına dönmek için SessionProvider bağlanır. */
export function setSessionExpiredHandler(handler: (() => void) | undefined) {
  onExpired = handler;
}

export const api = createApiClient({
  // Yerel deneme için: EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
  origin: process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_ORIGIN,
  tokens: secureTokens,
  onSessionExpired: () => onExpired?.(),
});

export const hasStoredSession = async () => (await secureTokens.get()) !== null;
