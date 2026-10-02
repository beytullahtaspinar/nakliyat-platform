import { NotificationChannel, UserRole } from '../generated/prisma/enums.js';

/**
 * Bildirim türleri. Kullanıcı her türü kanal bazında açıp kapatabilir (uygulama içi hariç).
 * Yeni tür eklerken: buraya, templates.ts'e ve bir dinleyiciye (notifications.listener.ts) ekle.
 */
export const NOTIFICATION_TYPES = {
  NEW_REQUEST: {
    label: 'Bölgemde yeni taşıma talebi',
    description: 'Hizmet verdiğin illerde müşteri talep oluşturduğunda',
    roles: [UserRole.COMPANY],
  },
  NEW_QUOTE: {
    label: 'Talebime yeni teklif',
    description: 'Bir firma taşıma talebine teklif verdiğinde',
    roles: [UserRole.CUSTOMER],
  },
  QUOTE_ACCEPTED: {
    label: 'Teklif kabulü',
    description: 'Bir teklif kabul edilip iş kesinleştiğinde',
    roles: [UserRole.CUSTOMER, UserRole.COMPANY],
  },
  NEW_MESSAGE: {
    label: 'Yeni mesaj',
    description: 'Anlaştığın firma ya da müşteri sana mesaj yazdığında',
    roles: [UserRole.CUSTOMER, UserRole.COMPANY],
  },
  REVIEW_REQUEST: {
    label: 'Değerlendirme hatırlatması',
    description: 'Taşınman tamamlandığında firmayı değerlendirmen için',
    roles: [UserRole.CUSTOMER],
  },
  NEW_REVIEW: {
    label: 'Yeni değerlendirme',
    description: 'Bir müşteri firmanı puanlayıp yorum yazdığında',
    roles: [UserRole.COMPANY],
  },
  COMPANY_VERIFICATION: {
    label: 'Firma hesabı onayı',
    description: 'Firma hesabın onaylandığında veya reddedildiğinde',
    roles: [UserRole.COMPANY],
  },
} as const satisfies Record<string, { label: string; description: string; roles: UserRole[] }>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

/**
 * Kullanıcının tercih edebildiği dış kanallar. SMS ve PUSH sağlayıcısı eklendiğinde
 * buraya eklenir; tercih ekranı ve API kendiliğinden genişler.
 */
export const OPTIONAL_CHANNELS = [NotificationChannel.EMAIL] as const;
export type OptionalChannel = (typeof OPTIONAL_CHANNELS)[number];

export const typesForRole = (role: UserRole) =>
  (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((type) =>
    (NOTIFICATION_TYPES[type].roles as readonly UserRole[]).includes(role),
  );
