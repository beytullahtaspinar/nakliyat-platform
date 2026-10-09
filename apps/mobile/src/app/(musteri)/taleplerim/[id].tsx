import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  CustomerBooking,
  CustomerQuote,
  MovingRequestDetail,
  Paginated,
  PublicCompany,
  RequestMedia,
  UnreadMessages,
} from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { CancelForm, MediaStrip, QuickAction, Row } from '@/components/booking-bits';
import { DetailScreen, Section } from '@/components/panel';
import { Stars } from '@/components/review';
import { AppText, Badge, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/bookings';
import { formatDate, REQUEST_STATUS } from '@/lib/format';
import { MAX_PHOTOS, pickPhotos, removePhoto, uploadPhotos } from '@/lib/request-media';
import { distanceText, floorLabel, formatMoney, homeTypeLabel, place, VEHICLE_LABELS } from '@/lib/requests';
import { useUser } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { WEB_ORIGIN } from '@/lib/variant';
import { colors } from '@/theme';

const COMMENT_MIN = 10;
const COMMENT_MAX = 2000;

/** Sitedeki /hesabim/talepler/[id]: teklifler, anlaşma, mesajlar, değerlendirme, talep bilgileri */
export default function RequestScreen() {
  const { id, yeni, medya } = useLocalSearchParams<{ id: string; yeni?: string; medya?: string }>();
  const user = useUser();
  const path = `/requests/${encodeURIComponent(id)}`;
  const { data: request, error, reload } = useApi<MovingRequestDetail>(path);
  const { data: quotes, reload: reloadQuotes } = useApi<CustomerQuote[]>(`${path}/quotes`);
  const hasBooking = request ? ['BOOKED', 'COMPLETED', 'CANCELLED'].includes(request.status) : false;
  const { data: bookings, reload: reloadBookings } = useApi<Paginated<CustomerBooking>>(hasBooking ? '/bookings?limit=50' : null);
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const [notice, setNotice] = useState<string | null>(yeni ? 'Talebin oluşturuldu.' : null);

  const refresh = () => Promise.all([reload(), reloadQuotes(), reloadBookings(), reloadUnread()]);

  if (!request) {
    return (
      <DetailScreen backLabel="Taleplerim" onRefresh={refresh}>
        {error ? <Notice>{error}</Notice> : <AppText style={{ color: colors.zinc600 }}>Talep yükleniyor…</AppText>}
      </DetailScreen>
    );
  }

  const booking = bookings?.items.find((b) => b.requestId === request.id);
  const status = REQUEST_STATUS[request.status];
  const acceptable = request.status === 'OPEN';
  const draft = request.status === 'DRAFT';
  const editable = acceptable || draft;
  const list = quotes ?? [];
  const pending = list.filter((q) => q.status === 'PENDING' && !q.isExpired);
  const prices = pending.map((q) => Number(q.priceTry));
  const cheapest = prices.length > 1 ? Math.min(...prices) : undefined;
  const unreadCount = booking ? (unread?.items.find((i) => i.bookingId === booking.id)?.count ?? 0) : 0;

  async function done(message: string) {
    setNotice(message);
    await refresh();
  }

  function accept(q: CustomerQuote) {
    Alert.alert(
      'Teklifi kabul et',
      `${q.company.displayName} firmasının ${formatMoney(q.priceTry)} teklifini kabul ediyorsun. Diğer teklifler kapanacak, firmayla iletişim bilgilerin paylaşılacak.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, kabul et',
          onPress: () =>
            void api
              .request(`/quotes/${encodeURIComponent(q.id)}/accept`, { method: 'POST' })
              .then(() => done('Teklifi kabul ettin, taşıman planlandı. Firmayla aşağıdan iletişime geçebilirsin.'))
              .catch((e: unknown) => Alert.alert('Kabul edilemedi', e instanceof Error ? e.message : 'Tekrar dene.')),
        },
      ],
    );
  }

  function cancelRequest() {
    Alert.alert('Talebi iptal et', 'Talebin iptal edilecek ve firmalar artık teklif veremeyecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Evet, iptal et',
        style: 'destructive',
        onPress: () =>
          void api
            .request(`${path}/cancel`, { method: 'POST' })
            .then(() => done('Talebin iptal edildi.'))
            .catch((e: unknown) => Alert.alert('İptal edilemedi', e instanceof Error ? e.message : 'Tekrar dene.')),
      },
    ]);
  }

  return (
    <DetailScreen backLabel="Taleplerim" onRefresh={refresh}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>
          {place(request.fromCityName, request.fromDistrictName)} → {place(request.toCityName, request.toDistrictName)}
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          {homeTypeLabel(request.homeType)} · {formatDate(request.moveDate)}
          {request.isDateFlexible ? ' (esnek)' : ''}
          {request.routeKm != null || request.distanceKm ? ` · ${distanceText(request)}` : ''}
          {request.estimatedVolumeM3 ? ` · yaklaşık ${request.estimatedVolumeM3} m³` : ''}
        </AppText>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>

      {notice ? <Notice tone="info">{notice}</Notice> : null}
      {medya === 'eksik' ? (
        <Notice>Bazı fotoğraflar yüklenemedi. Aşağıdaki fotoğraflar bölümünden tekrar ekleyebilirsin.</Notice>
      ) : null}
      {draft && !user.verified ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.amber300, backgroundColor: colors.amber50, padding: 16, gap: 10 }}>
          <AppText style={{ color: colors.amber900 }}>
            Talebin hazır, ancak firmalara iletilmesi için hesabını doğrulaman gerekiyor.
          </AppText>
          <Button title="Şimdi doğrula" onPress={() => router.push('/dogrulama')} />
        </View>
      ) : null}

      {booking ? (
        <BookingCard booking={booking} unreadCount={unreadCount} onChanged={done} />
      ) : null}

      {booking?.status === 'COMPLETED' ? <ReviewSection booking={booking} onSaved={() => done('Değerlendirmen kaydedildi, teşekkürler.')} /> : null}

      <Section
        title="Teklifler"
        description={
          pending.length > 1 && acceptable
            ? `${pending.length} geçerli teklif, ${formatMoney(Math.min(...prices))} ile ${formatMoney(Math.max(...prices))} arasında. Fiyata göre sıralı.`
            : undefined
        }
      >
        {list.length === 0 ? (
          <AppText style={{ color: colors.zinc600 }}>
            {acceptable
              ? `Henüz teklif gelmedi. Bölgendeki onaylı firmalar talebini görüyor; teklif verdikçe burada listelenecek. Teklif toplama ${formatDate(request.expiresAt)} tarihinde sona erer.`
              : draft
                ? 'Hesabını doğruladığında talebin firmalara iletilir ve teklifler burada listelenir.'
                : 'Bu talebe teklif gelmedi.'}
          </AppText>
        ) : (
          list.map((q, i) => (
            <View key={q.id} style={{ gap: 12 }}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: colors.zinc100 }} /> : null}
              <QuoteBlock
                quote={q}
                cheapest={cheapest !== undefined && Number(q.priceTry) === cheapest && q.status === 'PENDING' && !q.isExpired}
                onAccept={acceptable && q.status === 'PENDING' && !q.isExpired ? () => accept(q) : undefined}
              />
            </View>
          ))
        )}
      </Section>

      <Section title="Talep bilgilerin" description="Açık adresin yalnızca teklifini kabul ettiğin firmayla paylaşılır.">
        <Row label="Çıkış">{`${request.fromAddress} · ${floorLabel(request.fromFloor)}, ${request.fromHasElevator ? 'asansörlü' : 'asansörsüz'}`}</Row>
        <Row label="Varış">{`${request.toAddress} · ${floorLabel(request.toFloor)}, ${request.toHasElevator ? 'asansörlü' : 'asansörsüz'}`}</Row>
        <Row label="Hizmetler">
          {[request.needsPacking && 'Paketleme', request.needsAssembly && 'Söküm/kurulum', request.needsStorage && 'Depolama']
            .filter(Boolean)
            .join(', ') || 'Yok'}
        </Row>
        {request.specialItems.length ? <Row label="Özel eşya">{request.specialItems.join(', ')}</Row> : null}
        {request.notes ? <Row label="Notun">{request.notes}</Row> : null}
      </Section>

      {editable || request.media.length > 0 ? (
        <PhotosSection requestId={request.id} media={request.media} editable={editable} onChanged={refresh} />
      ) : null}

      {editable ? <Button title="Talebi iptal et" kind="secondary" onPress={cancelRequest} /> : null}
    </DetailScreen>
  );
}

function CompanyLine({ company }: { company: PublicCompany }) {
  const rating = Number(company.ratingAverage);
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      {company.verified && company.logoUrl ? (
        <Image
          source={{ uri: company.logoUrl.startsWith('http') ? company.logoUrl : `${WEB_ORIGIN}${company.logoUrl}` }}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.zinc100 }}
        />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
          <AppText weight="bold" style={{ color: colors.brand700, fontSize: 18 }}>
            {company.displayName.charAt(0)}
          </AppText>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="semibold" style={{ fontSize: 16 }}>
          {company.displayName}
        </AppText>
        {company.verified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={14} color={colors.green700} />
            <AppText weight="semibold" style={{ color: colors.green700, fontSize: 13 }}>
              {company.badges?.includes('DOCUMENTS_VERIFIED') ? 'Belgeleri doğrulandı' : 'Doğrulanmış firma'}
            </AppText>
          </View>
        ) : null}
        <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
          {[
            company.cityName,
            company.ratingCount > 0 ? `★ ${rating.toFixed(1).replace('.', ',')} (${company.ratingCount} yorum)` : 'Henüz yorum yok',
            company.completedJobs > 0 ? `${company.completedJobs} tamamlanan iş` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const QUOTE_NOTE: Partial<Record<CustomerQuote['status'], string>> = {
  ACCEPTED: 'Kabul ettiğin teklif',
  REJECTED: 'Başka bir teklif seçildi',
  EXPIRED: 'Süresi doldu',
  WITHDRAWN: 'Firma teklifini geri çekti',
};

function QuoteBlock({ quote, cheapest, onAccept }: { quote: CustomerQuote; cheapest: boolean; onAccept?: () => void }) {
  const note = quote.isExpired && quote.status === 'PENDING' ? 'Süresi doldu' : QUOTE_NOTE[quote.status];
  const included = [quote.includesPacking && 'Paketleme', quote.includesAssembly && 'Söküm/kurulum', quote.includesInsurance && 'Taşıma sigortası'].filter(
    Boolean,
  ) as string[];
  const dimmed = note && quote.status !== 'ACCEPTED';
  return (
    <View style={{ gap: 10, opacity: dimmed ? 0.6 : 1 }}>
      <CompanyLine company={quote.company} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <AppText weight="bold" style={{ fontSize: 24, lineHeight: 30 }}>
          {formatMoney(quote.priceTry)}
        </AppText>
        {cheapest ? <Badge tone="brand">En uygun fiyat</Badge> : null}
        {note ? <Badge tone={quote.status === 'ACCEPTED' ? 'success' : 'neutral'}>{note}</Badge> : null}
      </View>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
        {VEHICLE_LABELS[quote.vehicleType]} · {quote.crewSize} kişilik ekip · geçerlilik {formatDate(quote.validUntil)}
      </AppText>
      <AppText style={{ fontSize: 14 }}>Fiyata dahil: {included.length ? included.join(', ') : 'Yalnızca taşıma'}</AppText>
      {quote.message ? (
        <View style={{ backgroundColor: colors.zinc50, borderRadius: 10, padding: 12 }}>
          <AppText style={{ fontSize: 14, lineHeight: 20 }}>{quote.message}</AppText>
        </View>
      ) : null}
      {onAccept ? <Button title="Bu teklifi kabul et" onPress={onAccept} /> : null}
    </View>
  );
}

function BookingCard({
  booking,
  unreadCount,
  onChanged,
}: {
  booking: CustomerBooking;
  unreadCount: number;
  onChanged: (message: string) => Promise<void>;
}) {
  const { company } = booking;

  if (booking.status === 'CANCELLED') {
    return (
      <Section title="Taşıma iptal edildi">
        <AppText>
          {company.displayName} · {formatMoney(booking.priceTry)} · {formatDate(booking.scheduledAt)}
          {booking.cancelledAt ? ` · iptal: ${formatDate(booking.cancelledAt)}` : ''}
        </AppText>
        {booking.cancelReason ? <AppText>İptal nedeni: {booking.cancelReason}</AppText> : null}
        <Button title="Yeni talep oluştur" kind="secondary" onPress={() => router.push('/teklif-al')} />
      </Section>
    );
  }

  function confirmComplete() {
    Alert.alert(
      'Taşınma tamamlandı mı?',
      `${company.displayName} taşımanı bitirdi mi? Onaylarsan iş tamamlandı olarak kapanır ve firmayı değerlendirebilirsin.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, tamamlandı',
          onPress: () =>
            void api
              .request(`/bookings/${booking.id}/complete`, { method: 'POST' })
              .then(() => onChanged('Taşıman tamamlandı olarak işaretlendi. Firmayı aşağıdan değerlendirebilirsin.'))
              .catch((e: unknown) => Alert.alert('İşaretlenemedi', e instanceof Error ? e.message : 'Tekrar dene.')),
        },
      ],
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.green700, backgroundColor: colors.green50, padding: 16, gap: 6 }}>
        <AppText weight="bold" style={{ fontSize: 17, color: colors.green700 }}>
          {booking.status === 'COMPLETED' ? 'Taşıman tamamlandı' : 'Taşıman planlandı'}
        </AppText>
        <AppText>
          {company.displayName} · {formatMoney(booking.priceTry)} · {formatDate(booking.scheduledAt)}
        </AppText>
        <AppText>
          Firma yetkilisi: <AppText weight="semibold">{company.contactName}</AppText>
        </AppText>
        <AppText>
          Telefon:{' '}
          <AppText
            weight="semibold"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`tel:${company.contactPhone}`)}
            style={{ textDecorationLine: 'underline' }}
          >
            {formatPhone(company.contactPhone)}
          </AppText>
        </AppText>
        {booking.status === 'SCHEDULED' ? (
          <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.zinc600 }}>
            Firma da senin iletişim bilgilerini ve açık adresini artık görebiliyor. Detayları mesajlardan ya da telefonla netleştirebilirsin.
            {booking.canComplete ? '' : ' Taşınma günü geldiğinde işi tamamlandı olarak işaretleyip firmayı değerlendirebileceksin.'}
          </AppText>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <QuickAction icon="call" label="Ara" onPress={() => void Linking.openURL(`tel:${company.contactPhone}`)} />
        <QuickAction
          icon="chatbubbles"
          label={unreadCount > 0 ? `Mesajlar (${unreadCount})` : 'Mesajlar'}
          highlight={unreadCount > 0}
          onPress={() => router.push({ pathname: '/mesajlar/[id]', params: { id: booking.id } })}
        />
      </View>

      {booking.canComplete || booking.canCancel ? (
        <Section title="İşlemler">
          {booking.canComplete ? <Button title="Taşınma tamamlandı" onPress={confirmComplete} /> : null}
          {booking.canCancel ? (
            <CancelForm
              bookingId={booking.id}
              consequence={`${company.displayName} ile anlaştığın taşıma iptal edilecek ve firmaya haber verilecek. Yeniden teklif almak için yeni talep oluşturman gerekir.`}
              placeholder="Örnek: Taşınma tarihim değişti, ev sahibi çıkışı bir ay erteledi."
              onCancelled={() => onChanged('Taşıma iptal edildi, firmaya haber verildi.')}
            />
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}

/** Tamamlanan işte bir kez yapılan değerlendirme; sonradan değiştirilemez */
function ReviewSection({ booking, onSaved }: { booking: CustomerBooking; onSaved: () => Promise<void> }) {
  const { review, company } = booking;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (review) {
    return (
      <Section title="Değerlendirmen">
        <Stars rating={review.rating} />
        <AppText style={{ color: review.comment ? colors.zinc900 : colors.zinc600 }}>{review.comment || 'Yorum yazmadın.'}</AppText>
        {!review.isPublished ? (
          <Notice>
            {`Yorumun site kurallarına uymadığı için yayından kaldırıldı.${review.hiddenReason ? ` Gerekçe: ${review.hiddenReason}` : ''}`}
          </Notice>
        ) : null}
        {review.companyReply ? (
          <View style={{ borderLeftWidth: 3, borderLeftColor: colors.brand700, paddingLeft: 12, gap: 2 }}>
            <AppText weight="semibold" style={{ fontSize: 14 }}>
              {company.displayName} yanıtı
            </AppText>
            <AppText>{review.companyReply}</AppText>
          </View>
        ) : null}
      </Section>
    );
  }

  async function submit() {
    if (rating < 1) return setError('Yıldızlara dokunarak puan ver.');
    const text = comment.trim();
    if (text && text.length < COMMENT_MIN) return setError(`Yorumun en az ${COMMENT_MIN} karakter olmalı ya da boş bırak.`);
    setError(null);
    setSaving(true);
    try {
      await api.request(`/bookings/${booking.id}/review`, { method: 'POST', body: { rating, ...(text && { comment: text }) } });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Değerlendirme gönderilemedi.');
      setSaving(false);
    }
  }

  return (
    <Section
      title={`${company.displayName} firmasını değerlendir`}
      description="Puanın firmanın ortalamasına eklenir ve taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder. Değerlendirme bir kez yapılır, sonradan değiştirilemez."
    >
      <View accessibilityRole="adjustable" accessibilityLabel={`Puan: 5 üzerinden ${rating}`} style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name={n <= rating ? 'star' : 'star-outline'}
            size={36}
            color={colors.amber500}
            accessibilityRole="button"
            accessibilityLabel={`${n} yıldız`}
            onPress={() => setRating(n)}
          />
        ))}
      </View>
      <Field
        label="Yorumun (isteğe bağlı)"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={COMMENT_MAX}
        placeholder="Ekip zamanında geldi mi, eşyalara özen gösterdi mi?"
        style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Değerlendirmeyi gönder" loading={saving} onPress={() => void submit()} />
    </Section>
  );
}

function PhotosSection({
  requestId,
  media,
  editable,
  onChanged,
}: {
  requestId: string;
  media: RequestMedia[];
  editable: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoCount = media.filter((m) => m.type === 'PHOTO').length;

  async function add(source: 'library' | 'camera') {
    setError(null);
    setBusy(true);
    try {
      const photos = await pickPhotos(source, MAX_PHOTOS - photoCount);
      if (photos.length) {
        const { failed } = await uploadPhotos(requestId, photos);
        if (failed) setError(`${failed} fotoğraf yüklenemedi, tekrar dene.`);
        await onChanged();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fotoğraf eklenemedi.');
    } finally {
      setBusy(false);
    }
  }

  function remove(m: RequestMedia) {
    Alert.alert('Fotoğrafı sil', 'Bu dosya talepten kaldırılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          void removePhoto(requestId, m.id)
            .then(onChanged)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Silinemedi.')),
      },
    ]);
  }

  return (
    <Section
      title="Fotoğraf ve videolar"
      description={
        editable ? 'Eşyalarını görmek firmaların daha doğru fiyat vermesini sağlar. Firmalar adres ve iletişim bilgilerini görmez.' : undefined
      }
    >
      {media.length ? (
        <MediaStrip media={media} onRemove={editable ? remove : undefined} />
      ) : (
        <AppText style={{ color: colors.zinc600 }}>Henüz fotoğraf eklemedin.</AppText>
      )}
      {error ? <Notice>{error}</Notice> : null}
      {editable && photoCount < MAX_PHOTOS ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Galeriden ekle" kind="secondary" loading={busy} onPress={() => void add('library')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Fotoğraf çek" kind="secondary" disabled={busy} onPress={() => void add('camera')} />
          </View>
        </View>
      ) : null}
    </Section>
  );
}
