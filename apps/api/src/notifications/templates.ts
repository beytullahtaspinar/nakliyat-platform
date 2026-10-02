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
};
