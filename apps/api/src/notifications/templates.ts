import { AUTO_COMPLETE_DAYS } from '../reviews/review-rules.js';
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

  reviewRequest(p: { companyName: string; requestId: string; by: 'COMPANY' | 'SYSTEM' }): NotificationContent {
    const opening =
      p.by === 'COMPANY'
        ? `${p.companyName} işi tamamlandı olarak işaretledi.`
        : `Taşınma gününün üzerinden ${AUTO_COMPLETE_DAYS} gün geçti ve itiraz gelmediği için taşıman tamamlandı sayıldı.`;
    return {
      type: 'REVIEW_REQUEST',
      title: `Taşınman tamamlandı: ${p.companyName} firmasını değerlendir`,
      body: `${opening} Puanın ve yorumun, taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder.`,
      path: `/hesabim/talepler/${p.requestId}#degerlendirme`,
      actionLabel: 'Firmayı değerlendir',
    };
  },

  /** Taşınma gününün ertesi günü müşteriye: tamamlandıysa işaretle, yapılmadıysa itiraz et */
  completionCheckForCustomer(p: Route & { requestId: string; companyName: string; autoCompleteOn: Date }): NotificationContent {
    return {
      type: 'BOOKING_FOLLOW_UP',
      title: `Taşınman tamamlandı mı? ${p.companyName}`,
      body: `${formatDate(p.moveDate)} tarihli taşıman bittiyse "Taşınma tamamlandı" de ve firmayı değerlendir. Taşınma yapılmadıysa itiraz et; itiraz olmazsa iş ${formatDate(p.autoCompleteOn)} tarihinde tamamlandı sayılır.`,
      details: [`Firma: ${p.companyName}`, `Güzergâh: ${routeLine(p)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/hesabim/talepler/${p.requestId}`,
      actionLabel: 'Taşınmayı onayla',
    };
  },

  completionCheckForCompany(p: Route & { bookingId: string; customerName: string; autoCompleteOn: Date }): NotificationContent {
    return {
      type: 'BOOKING_FOLLOW_UP',
      title: `İşi tamamladın mı? ${routeLine(p)}`,
      body: `${p.customerName} müşterinin ${formatDate(p.moveDate)} tarihli taşımasını bitirdiysen işi tamamlandı olarak işaretle. Taşıma yapılmadıysa itiraz et; itiraz olmazsa iş ${formatDate(p.autoCompleteOn)} tarihinde tamamlandı sayılır.`,
      details: [`Müşteri: ${p.customerName}`, `Güzergâh: ${routeLine(p)}`, `Taşınma tarihi: ${formatDate(p.moveDate)}`],
      path: `/firma-paneli/isler/${p.bookingId}`,
      actionLabel: 'İşi tamamla',
    };
  },

  /** Kimse işaretlemeyince iş kendiliğinden tamamlandı; firmaya bilgi */
  autoCompletedForCompany(p: Route & { bookingId: string; customerName: string }): NotificationContent {
    return {
      type: 'BOOKING_FOLLOW_UP',
      title: `İş tamamlandı sayıldı: ${routeLine(p)}`,
      body: `${p.customerName} müşterinin ${formatDate(p.moveDate)} tarihli taşıması, ${AUTO_COMPLETE_DAYS} gün içinde itiraz gelmediği için tamamlandı sayıldı. Müşteriden değerlendirme istendi.`,
      details: [`Müşteri: ${p.customerName}`, `Güzergâh: ${routeLine(p)}`],
      path: `/firma-paneli/isler/${p.bookingId}`,
      actionLabel: 'İşi görüntüle',
    };
  },

  /** Karşı taraf "taşınma yapılmadı" dedi */
  bookingDisputed(p: Route & { path: string; by: string; reason: string }): NotificationContent {
    return {
      type: 'BOOKING_FOLLOW_UP',
      title: `İtiraz: ${p.by} taşınmanın yapılmadığını bildirdi`,
      body: `${formatDate(p.moveDate)} tarihli iş tamamlanmış sayılmayacak; yönetim inceleyip karar verecek. Gerekirse sana destek@evdenevenakliyat.app adresinden ulaşacağız.`,
      details: [`Güzergâh: ${routeLine(p)}`, `İtiraz nedeni: ${p.reason}`],
      path: p.path,
      actionLabel: 'İşi görüntüle',
    };
  },

  /** Yönetimin itiraz kararı; tamamlandıysa müşteriye değerlendirme bağlantısı */
  disputeResolved(p: Route & { path: string; decision: 'complete' | 'cancel'; note: string; forCustomer: boolean }): NotificationContent {
    const completed = p.decision === 'complete';
    return {
      type: 'BOOKING_FOLLOW_UP',
      title: completed ? `İtiraz sonuçlandı: iş tamamlandı sayıldı` : `İtiraz sonuçlandı: iş iptal edildi`,
      body: completed
        ? `Yönetim ${formatDate(p.moveDate)} tarihli taşınmanın yapıldığına karar verdi.${p.forCustomer ? ' Firmayı artık değerlendirebilirsin.' : ''}`
        : `Yönetim ${formatDate(p.moveDate)} tarihli taşınmanın yapılmadığına karar verdi; iş iptal edildi.`,
      details: [`Güzergâh: ${routeLine(p)}`, `Yönetimin açıklaması: ${p.note}`],
      path: completed && p.forCustomer ? `${p.path}#degerlendirme` : p.path,
      actionLabel: completed && p.forCustomer ? 'Firmayı değerlendir' : 'İşi görüntüle',
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

  reviewUpdated(p: { rating: number; previousRating: number; comment: string | null; hasReply: boolean }): NotificationContent {
    const excerpt = p.comment && p.comment.length > 300 ? `${p.comment.slice(0, 300).trimEnd()}…` : p.comment;
    const ratingChange = p.rating === p.previousRating ? `${p.rating} yıldız` : `${p.previousRating} → ${p.rating} yıldız`;
    return {
      type: 'NEW_REVIEW',
      title: `Müşterin değerlendirmesini düzenledi: ${ratingChange}`,
      body: excerpt ?? 'Müşterin yorumunu kaldırıp yalnızca puan bıraktı.',
      ...(p.hasReply && { details: ['Yanıtın yorumun altında duruyor; yeni metne göre güncelleyebilirsin.'] }),
      path: '/firma-paneli/degerlendirmeler',
      actionLabel: p.hasReply ? 'Yorumu oku, yanıtını güncelle' : 'Yorumu oku ve yanıtla',
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
      type: 'CREDIT_TOPUP',
      title: `Havalen onaylandı: ${credits} kredi yüklendi`,
      body: `${formatTry(p.amountTry)} tutarındaki havalen hesabımıza geçti. Yeni bakiyen ${p.balance.toLocaleString('tr-TR')} kredi.`,
      details: [`Tutar: ${formatTry(p.amountTry)}`, `Yüklenen: ${credits} kredi`, `Bakiye: ${p.balance.toLocaleString('tr-TR')} kredi`],
      path: '/firma-paneli/kredi',
      actionLabel: 'Kredi hareketlerini gör',
    };
  },

  transferRejected(p: { amountTry: string; reason: string | null }): NotificationContent {
    return {
      type: 'CREDIT_TOPUP',
      title: 'Havale bildirimin onaylanmadı',
      body: `${formatTry(p.amountTry)} tutarındaki havale bildirimin için kredi yüklenmedi. Gerekçeye bakıp bize yazabilir ya da yeniden bildirebilirsin.`,
      details: p.reason ? [`Gerekçe: ${p.reason}`] : undefined,
      path: '/firma-paneli/kredi',
      actionLabel: 'Kredi sayfasına git',
    };
  },

  cardPaid(p: { amountTry: string; credits: number; balance: number }): NotificationContent {
    const credits = p.credits.toLocaleString('tr-TR');
    return {
      type: 'CREDIT_TOPUP',
      title: `Ödemen alındı: ${credits} kredi yüklendi`,
      body: `${formatTry(p.amountTry)} kartla ödemen başarılı. Yeni bakiyen ${p.balance.toLocaleString('tr-TR')} kredi.`,
      details: [`Tutar: ${formatTry(p.amountTry)}`, `Yüklenen: ${credits} kredi`, `Bakiye: ${p.balance.toLocaleString('tr-TR')} kredi`],
      path: '/firma-paneli/kredi',
      actionLabel: 'Kredi hareketlerini gör',
    };
  },
};
