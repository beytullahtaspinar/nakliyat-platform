import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Tek kod tabanından iki ayrı uygulama çıkar:
 * - firma:   nakliyat firmaları için (gelen talepler, teklifler, işler)
 * - musteri: taşınacak kişiler için (talep, teklif karşılaştırma)
 * Seçim APP_VARIANT ortam değişkeniyle yapılır (varsayılan: musteri). eas.json her profilde bunu verir.
 * Paket kimlikleri mağazada değiştirilemez; yayından sonra dokunma.
 */
const VARIANTS = {
  firma: {
    name: 'Evdenevenakliyat Firma',
    slug: 'evdenevenakliyat-firma',
    scheme: 'evdenevenakliyat-firma',
    id: 'app.evdenevenakliyat.firma',
    background: '#f97316',
    /** expo.dev'deki projenin kimliği (gizli değildir) */
    easProjectId: '084d903b-b052-4101-8a94-e6153827d0b7' as string | undefined,
  },
  musteri: {
    name: 'Evdenevenakliyat',
    slug: 'evdenevenakliyat',
    scheme: 'evdenevenakliyat',
    id: 'app.evdenevenakliyat.musteri',
    background: '#1e3a8a',
    easProjectId: '724e123c-2655-4a5a-8541-e3dae4cac277' as string | undefined,
  },
} as const;

export type AppVariant = keyof typeof VARIANTS;

const variant: AppVariant = process.env.APP_VARIANT === 'firma' ? 'firma' : 'musteri';
const v = VARIANTS[variant];
const assets = `./assets/${variant}`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  /** expo.dev hesabı: projeler bu hesabın altında */
  owner: 'beytullah001',
  name: v.name,
  slug: v.slug,
  scheme: v.scheme,
  version: '0.1.0',
  orientation: 'portrait',
  icon: `${assets}/icon.png`,
  // Site gibi uygulama da her zaman açık zemin
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: v.id,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: v.id,
    adaptiveIcon: {
      backgroundColor: v.background,
      foregroundImage: `${assets}/android-icon-foreground.png`,
      backgroundImage: `${assets}/android-icon-background.png`,
      monochromeImage: `${assets}/android-icon-monochrome.png`,
    },
    predictiveBackGestureEnabled: false,
    // Anlık bildirim için Firebase dosyası. Gizli değildir ama depoya konmaz: EAS'ta "file" türünde
    // GOOGLE_SERVICES_JSON ortam değişkeni olarak yüklenir, derleme sırasında dosya yolu buraya gelir.
    ...(process.env.GOOGLE_SERVICES_JSON && { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }),
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-notifications', { icon: `${assets}/notification-icon.png`, color: v.background, defaultChannel: 'default' }],
    [
      'expo-splash-screen',
      { image: `${assets}/splash-icon.png`, imageWidth: 160, resizeMode: 'contain', backgroundColor: v.background },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: { variant, ...(v.easProjectId && { eas: { projectId: v.easProjectId } }) },
});
