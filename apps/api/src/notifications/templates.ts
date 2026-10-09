import { NotificationType } from './notification-types.js';

/** Kanaldan bağımsız bildirim içeriği. Her kanal bunu kendi biçimine çevirir. */
export interface NotificationContent {
  type: NotificationType;
  /** Kısa başlık: e-posta konusu, push başlığı, uygulama içi başlık */
  title: string;
  /** Bir iki cümlelik özet: push/SMS metni ve uygulama içi gövde */
  body: string;
  /** E-postada başlığın altında gösterilen ek satırlar (ör. güzergâh, tarih) */
  details?: string[];
  /** Web/mobil uygulamada açılacak yol, ör. /hesabim/talepler/abc */
  path: string;
  /** Bağlantı düğmesinin metni */
  actionLabel: string;
}

const tryFormat = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

export const formatTry = (value: number | string | { toString(): string }) => tryFormat.format(Number(value.toString()));
export const formatDate = (date: Date) => dateFormat.format(date);

interface Route {
  from: string;
  to: string;
  moveDate: Date;
}
const routeLine = ({ from, to }: Route) => `${from} → ${to}`;

export const templates = {
  newRequest(p: Route & { requestId: string; homeTypeLabel: string }): NotificationContent {
    return {
      type: 'NEW_REQUEST',
      title: `Yeni talep: ${routeLine(p)}`,
      body: `${p.homeTypeLabel} taşıması, ${formatDate(p.moveDate)}. İlk teklifi veren sen ol.`,
      details: [`Güzergâh: ${routeLine(p)}`, `Ev tipi: ${p.homeTypeLabel}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/firma-paneli/talepler/${p.requestId}`,
      actionLabel: 'Talebi incele ve teklif ver',
    };
  },

  newQuote(p: Route & { requestId: string; companyName: string; priceTry: string }): NotificationContent {
    return {
      type: 'NEW_QUOTE',
      title: `${p.companyName} teklif verdi: ${formatTry(p.priceTry)}`,
      body: `${routeLine(p)} taşıman için yeni bir teklif geldi. Teklifleri karşılaştırıp sana uyanı seçebilirsin.`,
      details: [`Firma: ${p.companyName}`, `Fiyat: ${formatTry(p.priceTry)}`, `Güzergâh: ${routeLine(p)}`],
      path: `/hesabim/talepler/${p.requestId}`,
      actionLabel: 'Teklifleri karşılaştır',
    };
  },

  quoteAcceptedForCustomer(p: Route & { requestId: string; companyName: string; priceTry: string }): NotificationContent {
    return {
      type: 'QUOTE_ACCEPTED',
      title: `Taşıman kesinleşti: ${p.companyName}`,
      body: `${p.companyName} firmasının ${formatTry(p.priceTry)} teklifini kabul ettin. Firma seninle iletişime geçecek.`,
      details: [`Firma: ${p.companyName}`, `Fiyat: ${formatTry(p.priceTry)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/hesabim/talepler/${p.requestId}`,
      actionLabel: 'Firma iletişim bilgilerini gör',
    };
  },

  quoteAcceptedForCompany(p: Route & { priceTry: string }): NotificationContent {
    return {
      type: 'QUOTE_ACCEPTED',
      title: `Teklifin kabul edildi: ${routeLine(p)}`,
      body: `Müşteri ${formatTry(p.priceTry)} teklifini kabul etti. Müşterinin iletişim ve adres bilgileri İşlerim sayfasında.`,
      details: [`Güzergâh: ${routeLine(p)}`, `Fiyat: ${formatTry(p.priceTry)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: '/firma-paneli/isler',
      actionLabel: 'İşi görüntüle',
    };
  },

  newMessage(p: { senderName: string; body: string; path: string }): NotificationContent {
    const excerpt = p.body.length > 300 ? `${p.body.slice(0, 300).trimEnd()}…` : p.body;
    return {
      type: 'NEW_MESSAGE',
      title: `${p.senderName} sana mesaj yazdı`,
      body: excerpt,
      path: p.path,
      actionLabel: 'Mesajı oku ve yanıtla',
    };
  },

  moveReminderForCustomer(
    p: Route & { requestId: string; companyName: string; companyPhone: string },
  ): NotificationContent {
    return {
      type: 'MOVE_REMINDER',
      title: `Yarın taşınıyorsun: ${p.companyName}`,
      body: `${routeLine(p)} taşıman yarın, ${formatDate(p.moveDate)}. Firmayla saati ve son ayrıntıları konuşmak için mesaj yazabilir ya da arayabilirsin.`,
      details: [`Firma: ${p.companyName}`, `Telefon: ${p.companyPhone}`, `Güzergâh: ${routeLine(p)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/hesabim/talepler/${p.requestId}#mesajlar`,
      actionLabel: 'Taşınma ayrıntılarını gör',
    };
  },

  moveReminderForCompany(p: Route & { bookingId: string; customerName: string; customerPhone: string }): NotificationContent {
    return {
      type: 'MOVE_REMINDER',
      title: `Yarın taşıma var: ${routeLine(p)}`,
      body: `${p.customerName} müşterinin taşıması yarın, ${formatDate(p.moveDate)}. Ekibini ve aracını hazırla, müşteriyle saati teyit et.`,
      details: [`Müşteri: ${p.customerName}`, `Telefon: ${p.customerPhone}`, `Güzergâh: ${routeLine(p)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/firma-paneli/isler/${p.bookingId}`,
      actionLabel: 'İşi görüntüle',
    };
  },

  bookingCancelledForCustomer(p: Route & { requestId: string; companyName: string; reason: string }): NotificationContent {
    return {
      type: 'BOOKING_CANCELLED',
      title: `${p.companyName} taşımanı iptal etti`,
      body: `${formatDate(p.moveDate)} tarihli taşıman iptal edildi. Yeni bir talep oluşturarak diğer firmalardan hemen teklif alabilirsin.`,
      details: [`Güzergâh: ${routeLine(p)}`, `İptal nedeni: ${p.reason}`],
      path: '/talep-olustur',
      actionLabel: 'Yeni talep oluştur',
    };
  },

  bookingCancelledForCompany(p: Route & { bookingId: string; reason: string }): NotificationContent {
    return {
      type: 'BOOKING_CANCELLED',
      title: `Müşteri taşımayı iptal etti: ${routeLine(p)}`,
      body: `${formatDate(p.moveDate)} tarihli iş iptal edildi; takviminden düşüldü.`,
      details: [`Güzergâh: ${routeLine(p)}`, `İptal nedeni: ${p.reason}`],
      path: `/firma-paneli/isler/${p.bookingId}`,
      actionLabel: 'İşi görüntüle',
    };
  },

  reviewRequest(p: { companyName: string; requestId: string }): NotificationContent {
    return {
      type: 'REVIEW_REQUEST',
      title: `Taşınman tamamlandı: ${p.companyName} firmasını değerlendir`,
      body: `${p.companyName} işi tamamlandı olarak işaretledi. Puanın ve yorumun, taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder.`,
      path: `/hesabim/talepler/${p.requestId}#degerlendirme`,
      actionLabel: 'Firmayı değerlendir',
    };
  },

  newReview(p: { rating: number; comment: string | null }): NotificationContent {
    const excerpt = p.comment && p.comment.length > 300 ? `${p.comment.slice(0, 300).trimEnd()}…` : p.comment;
    return {
      type: 'NEW_REVIEW',
      title: `Yeni değerlendirme: ${p.rating} yıldız`,
      body: excerpt ?? 'Müşterin yorum yazmadan puan verdi.',
      path: '/firma-paneli/degerlendirmeler',
      actionLabel: excerpt ? 'Yorumu oku ve yanıtla' : 'Değerlendirmelerini gör',
    };
  },

  companyVerified(p: { companyName: string }): NotificationContent {
    return {
      type: 'COMPANY_VERIFICATION',
      title: 'Firma hesabın onaylandı',
      body: `${p.companyName} artık doğrulanmış firma. Bölgendeki taleplere teklif verebilirsin.`,
      path: '/firma-paneli',
      actionLabel: 'Gelen taleplere bak',
    };
  },

  companyRejected(p: { companyName: string; reason: string | null }): NotificationContent {
    return {
      type: 'COMPANY_VERIFICATION',
      title: 'Firma hesabın onaylanmadı',
      body: `${p.companyName} için doğrulama tamamlanamadı. Bilgilerini düzeltip tekrar gönderebilirsin.`,
      details: p.reason ? [`Gerekçe: ${p.reason}`] : undefined,
      path: '/firma-paneli/profil',
      actionLabel: 'Firma bilgilerini düzenle',
    };
  },

  companyNameApproved(p: { newName: string }): NotificationContent {
    return {
      type: 'COMPANY_VERIFICATION',
      title: 'Yeni firma adın yayında',
      body: `Görünen ad değişikliğin onaylandı. Müşteriler firmanı artık "${p.newName}" adıyla görüyor.`,
      path: '/firma-paneli/profil',
      actionLabel: 'Firma profiline git',
    };
  },

  companyNameRejected(p: { newName: string; reason: string | null }): NotificationContent {
    return {
      type: 'COMPANY_VERIFICATION',
      title: 'Ad değişikliğin onaylanmadı',
      body: `"${p.newName}" adı onaylanmadı; firman eski adıyla görünmeye devam ediyor.`,
      details: p.reason ? [`Gerekçe: ${p.reason}`] : undefined,
      path: '/firma-paneli/profil',
      actionLabel: 'Firma profiline git',
    };
  },

  transferApproved(p: { amountTry: string; credits: number; balance: number }): NotificationContent {
    const credits = p.credits.toLocaleString('tr-TR');
    return {
      type: 'CREDIT_TRANSFER',
      title: `Havalen onaylandı: ${credits} kredi yüklendi`,
      body: `${formatTry(p.amountTry)} tutarındaki havalen hesabımıza geçti. Yeni bakiyen ${p.balance.toLocaleString('tr-TR')} kredi.`,
      details: [`Tutar: ${formatTry(p.amountTry)}`, `Yüklenen: ${credits} kredi`, `Bakiye: ${p.balance.toLocaleString('tr-TR')} kredi`],
      path: '/firma-paneli/kredi',
      actionLabel: 'Kredi hareketlerini gör',
    };
  },

  transferRejected(p: { amountTry: string; reason: string | null }): NotificationContent {
    return {
      type: 'CREDIT_TRANSFER',
      title: 'Havale bildirimin onaylanmadı',
      body: `${formatTry(p.amountTry)} tutarındaki havale bildirimin için kredi yüklenmedi. Gerekçeye bakıp bize yazabilir ya da yeniden bildirebilirsin.`,
      details: p.reason ? [`Gerekçe: ${p.reason}`] : undefined,
      path: '/firma-paneli/kredi',
      actionLabel: 'Kredi sayfasına git',
    };
  },
};
