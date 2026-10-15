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
import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { CancelForm, DisputeForm, MediaStrip, QuickAction, Row } from '@/components/booking-bits';
import { useDialog } from '@/components/dialog';
import { RouteMapView } from '@/components/map';
import { DetailScreen, Section } from '@/components/panel';
import { ReportButton } from '@/components/report';
import { ReviewExcerpt, Stars } from '@/components/review';
import { AppText, Badge, Badges, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { followUpText, formatPhone } from '@/lib/bookings';
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
  const { id, yeni, medya, mesajlar } = useLocalSearchParams<{ id: string; yeni?: string; medya?: string; mesajlar?: string }>();
  const user = useUser();
  const dialog = useDialog();
  const path = `/requests/${encodeURIComponent(id)}`;
  const { data: request, error, reload } = useApi<MovingRequestDetail>(path);
  const { data: quotes, reload: reloadQuotes } = useApi<CustomerQuote[]>(`${path}/quotes`);
  const hasBooking = request ? ['BOOKED', 'COMPLETED', 'CANCELLED'].includes(request.status) : false;
  const { data: bookings, reload: reloadBookings } = useApi<Paginated<CustomerBooking>>(hasBooking ? '/bookings?limit=50' : null);
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const [notice, setNotice] = useState<string | null>(yeni ? 'Talebin oluşturuldu.' : null);
  const booking = request ? bookings?.items.find((b) => b.requestId === request.id) : undefined;

  // Mesaj bildirimine dokununca: anlaşma yüklenince yazışma açılır (bir kez)
  const openedMessages = useRef(false);
  useEffect(() => {
    if (!mesajlar || !booking || openedMessages.current) return;
    openedMessages.current = true;
    router.push({ pathname: '/mesajlar/[id]', params: { id: booking.id } });
  }, [mesajlar, booking]);

  const refresh = () => Promise.all([reload(), reloadQuotes(), reloadBookings(), reloadUnread()]);

  if (!request) {
    return (
      <DetailScreen backLabel="Taleplerim" onRefresh={refresh}>
        {error ? <Notice>{error}</Notice> : <AppText style={{ color: colors.zinc600 }}>Talep yükleniyor…</AppText>}
      </DetailScreen>
    );
  }

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
    void dialog
      .confirm({
        title: 'Teklif kabul edilsin mi?',
        message: `${q.company.displayName} firmasının ${formatMoney(q.priceTry)} teklifini kabul ediyorsun. Diğer teklifler kapanacak, firmayla iletişim bilgilerin paylaşılacak.`,
        confirmLabel: 'Evet, kabul et',
        icon: 'checkmark-circle-outline',
        action: () => api.request(`/quotes/${encodeURIComponent(q.id)}/accept`, { method: 'POST' }),
      })
      .then((ok) => {
        if (ok) void done('Teklifi kabul ettin, taşıman planlandı. Firmayla aşağıdan iletişime geçebilirsin.');
      });
  }

  function cancelRequest() {
    void dialog
      .confirm({
        title: 'Talep iptal edilsin mi?',
        message: 'Talebin iptal edilecek ve firmalar artık teklif veremeyecek.',
        confirmLabel: 'Evet, iptal et',
        destructive: true,
        action: () => api.request(`${path}/cancel`, { method: 'POST' }),
      })
      .then((ok) => {
        if (ok) void done('Talebin iptal edildi.');
      });
  }

  const services = [request.needsPacking && 'Paketleme', request.needsAssembly && 'Söküm/kurulum', request.needsStorage && 'Depolama'].filter(
    (x): x is string => !!x,
  );
  const fromPin = request.fromLat != null && request.fromLng != null ? { lat: request.fromLat, lng: request.fromLng } : null;
  const toPin = request.toLat != null && request.toLng != null ? { lat: request.toLat, lng: request.toLng } : null;

  return (
    <DetailScreen backLabel="Taleplerim" onRefresh={refresh}>
      <View style={{ gap: 10 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>
          {place(request.fromCityName, request.fromDistrictName)} → {place(request.toCityName, request.toDistrictName)}
        </AppText>
        <Badges>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge icon="home-outline">{homeTypeLabel(request.homeType)}</Badge>
          <Badge icon="calendar-outline">{`${formatDate(request.moveDate)}${request.isDateFlexible ? ' (esnek)' : ''}`}</Badge>
          {request.routeKm != null || request.distanceKm ? <Badge icon="navigate-outline">{distanceText(request)}</Badge> : null}
          {request.estimatedVolumeM3 ? <Badge icon="cube-outline">{`yaklaşık ${request.estimatedVolumeM3} m³`}</Badge> : null}
        </Badges>
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

      <Section title="Talep bilgilerin" description="Açık adresin ve haritadaki işaretin yalnızca teklifini kabul ettiğin firmayla paylaşılır.">
        <RouteMapView from={fromPin} to={toPin} />
        <Row label="Çıkış">
          <StopInfo address={request.fromAddress} floor={request.fromFloor} elevator={request.fromHasElevator} />
        </Row>
        <Row label="Varış">
          <StopInfo address={request.toAddress} floor={request.toFloor} elevator={request.toHasElevator} />
        </Row>
        <Row label="Hizmetler">
          {services.length ? (
            <Badges>
              {services.map((label) => (
                <Badge key={label} icon="checkmark-circle" tone="success">
                  {label}
                </Badge>
              ))}
            </Badges>
          ) : (
            'Yok'
          )}
        </Row>
        {request.specialItems.length ? (
          <Row label="Özel eşya">
            <Badges>
              {request.specialItems.map((item) => (
                <Badge key={item} icon="alert-circle-outline" tone="warning">
                  {item}
                </Badge>
              ))}
            </Badges>
          </Row>
        ) : null}
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
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      {company.verified && company.logoUrl ? (
        // Logonun tamamı görünsün: kırpılmadan beyaz kutuya sığdırılır
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.zinc200,
            backgroundColor: colors.white,
            padding: 4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={{ uri: company.logoUrl.startsWith('http') ? company.logoUrl : `${WEB_ORIGIN}${company.logoUrl}` }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
          <AppText weight="bold" style={{ color: colors.brand700, fontSize: 22, lineHeight: 28 }}>
            {company.displayName.charAt(0)}
          </AppText>
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <AppText weight="semibold" numberOfLines={2} style={{ fontSize: 16, lineHeight: 21 }}>
          {company.displayName}
        </AppText>
        {company.verified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={14} color={colors.green700} />
            <AppText weight="semibold" style={{ color: colors.green700, fontSize: 13, lineHeight: 18 }}>
              {company.badges?.includes('DOCUMENTS_VERIFIED') ? 'Belgeleri doğrulandı' : 'Doğrulanmış firma'}
            </AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 }}>
          {company.ratingCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={13} color={colors.amber500} />
              <AppText weight="semibold" style={{ fontSize: 13, lineHeight: 18 }}>
                {rating.toFixed(1).replace('.', ',')}
              </AppText>
              <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>({company.ratingCount} yorum)</AppText>
            </View>
          ) : (
            <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>Henüz yorum yok</AppText>
          )}
          {company.completedJobs > 0 ? (
            <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>{company.completedJobs} tamamlanan iş</AppText>
          ) : null}
          {company.cityName ? <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>{company.cityName}</AppText> : null}
        </View>
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
      {quote.company.latestReview ? <ReviewExcerpt review={quote.company.latestReview} /> : null}
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
  const dialog = useDialog();
  const followUp = followUpText(booking, 'CUSTOMER');

  if (booking.status === 'CANCELLED') {
    return (
      <Section title="Taşıma iptal edildi">
        <AppText>
          {company.displayName} · {formatMoney(booking.priceTry)} · {formatDate(booking.scheduledAt)}
          {booking.cancelledAt ? ` · iptal: ${formatDate(booking.cancelledAt)}` : ''}
        </AppText>
        {booking.cancelReason ? <AppText>İptal nedeni: {booking.cancelReason}</AppText> : null}
        {followUp ? <AppText>{followUp}</AppText> : null}
        <Button title="Yeni talep oluştur" kind="secondary" onPress={() => router.push('/teklif-al')} />
      </Section>
    );
  }

  function confirmComplete() {
    void dialog
      .confirm({
        title: 'Taşınma tamamlandı mı?',
        message: `${company.displayName} taşımanı bitirdi mi? Onaylarsan iş tamamlandı olarak kapanır ve firmayı değerlendirebilirsin.`,
        confirmLabel: 'Evet, tamamlandı',
        icon: 'checkmark-circle-outline',
        action: () => api.request(`/bookings/${booking.id}/complete`, { method: 'POST' }),
      })
      .then((ok) => {
        if (ok) void onChanged('Taşıman tamamlandı olarak işaretlendi. Firmayı aşağıdan değerlendirebilirsin.');
      });
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
            {booking.canComplete || booking.disputedAt ? '' : ' Taşınma günü geldiğinde işi tamamlandı olarak işaretleyip firmayı değerlendirebileceksin.'}
          </AppText>
        ) : null}
        {followUp ? <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.zinc600 }}>{followUp}</AppText> : null}
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

      {booking.canComplete || booking.canCancel || booking.canDispute ? (
        <Section title="İşlemler">
          {booking.canComplete ? <Button title="Taşınma tamamlandı" onPress={confirmComplete} /> : null}
          {booking.canDispute ? (
            <DisputeForm
              bookingId={booking.id}
              counterpart={company.displayName}
              onDisputed={() => onChanged('İtirazın yönetime iletildi; firmaya da haber verildi.')}
            />
          ) : null}
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

/** Tamamlanan işte değerlendirme; müşteri sonradan puanını ve yorumunu düzenleyebilir */
function ReviewSection({ booking, onSaved }: { booking: CustomerBooking; onSaved: () => Promise<void> }) {
  const { review, company } = booking;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    if (!review) return;
    setRating(review.rating);
    setComment(review.comment ?? '');
    setError(null);
    setEditing(true);
  }

  if (review && !editing) {
    return (
      <Section title="Değerlendirmen">
        <Stars rating={review.rating} />
        <AppText style={{ color: review.comment ? colors.zinc900 : colors.zinc600 }}>{review.comment || 'Yorum yazmadın.'}</AppText>
        {review.editedAt ? <AppText style={{ color: colors.zinc500, fontSize: 13 }}>{`Düzenlendi: ${formatDate(review.editedAt)}`}</AppText> : null}
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
            <ReportButton target="REVIEW_REPLY" targetId={review.id} compact />
          </View>
        ) : null}
        {/* Yönetimce kaldırılan yorum düzenlenemez: gizleme gerekçesi o metne ait */}
        {review.isPublished ? <Button title="Değerlendirmeni düzenle" kind="secondary" icon="create-outline" onPress={startEditing} /> : null}
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
      await api.request(`/bookings/${booking.id}/review`, {
        method: review ? 'PATCH' : 'POST',
        body: { rating, ...(text && { comment: text }) },
      });
      await onSaved();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Değerlendirme gönderilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={review ? 'Değerlendirmeni düzenle' : `${company.displayName} firmasını değerlendir`}
      description={
        review
          ? `Yorumunun yanında "düzenlendi" yazar ve firmaya haber verilir.${review.companyReply ? ' Firmanın yanıtı yerinde kalır.' : ''}`
          : 'Puanın firmanın ortalamasına eklenir ve taşınacak diğer ailelerin doğru firmayı seçmesine yardım eder. Fikrin değişirse sonradan düzenleyebilirsin.'
      }
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
      <Button title={review ? 'Değişiklikleri kaydet' : 'Değerlendirmeyi gönder'} loading={saving} onPress={() => void submit()} />
      {review ? <Button title="Vazgeç" kind="secondary" onPress={() => setEditing(false)} /> : null}
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
  const dialog = useDialog();
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
    void dialog
      .confirm({
        title: 'Fotoğraf silinsin mi?',
        message: 'Bu dosya talepten kaldırılacak.',
        confirmLabel: 'Sil',
        destructive: true,
        icon: 'trash-outline',
        action: () => removePhoto(requestId, m.id),
      })
      .then((ok) => {
        if (ok) void onChanged();
      });
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
            <Button title="Galeri" icon="images-outline" kind="secondary" loading={busy} onPress={() => void add('library')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Kamera" icon="camera-outline" kind="secondary" disabled={busy} onPress={() => void add('camera')} />
          </View>
        </View>
      ) : null}
    </Section>
  );
}

function StopInfo({ address, floor, elevator }: { address: string; floor: number; elevator: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText style={address ? undefined : { color: colors.zinc500 }}>{address || 'Açık adres yazılmadı'}</AppText>
      <Badges>
        <Badge icon="layers-outline">{floorLabel(floor)}</Badge>
        <Badge icon={elevator ? 'arrow-up-circle-outline' : 'walk-outline'}>{elevator ? 'Asansörlü' : 'Asansörsüz'}</Badge>
      </Badges>
    </View>
  );
}
