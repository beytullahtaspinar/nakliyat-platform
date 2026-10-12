import type { BookingPlace, CompanyBooking, UnreadMessages } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { CancelForm, QuickAction, Row } from '@/components/booking-bits';
import { DetailScreen, Section } from '@/components/panel';
import { ReviewBlock } from '@/components/review';
import { AppText, Badge, Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { BOOKING_STATUS, bookingRoute, directionsUrl, formatPhone, mapUrl } from '@/lib/bookings';
import { formatDate } from '@/lib/format';
import { distanceText, floorLabel, formatMoney, homeTypeLabel } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Sitedeki /firma-paneli/isler/[id]: müşteri bilgileri, adresler, değerlendirme ve işlemler */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, error, reload } = useApi<CompanyBooking>(`/company/bookings/${encodeURIComponent(id)}`);
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => Promise.all([reload(), reloadUnread()]);

  if (!booking) {
    return (
      <DetailScreen backLabel="İşlerim" onRefresh={refresh}>
        {error ? <Notice>{error}</Notice> : <AppText style={{ color: colors.zinc600 }}>İş yükleniyor…</AppText>}
      </DetailScreen>
    );
  }

  const { request: r, customer } = booking;
  const status = BOOKING_STATUS[booking.status];
  const unreadCount = unread?.items.find((i) => i.bookingId === booking.id)?.count ?? 0;

  async function done(message: string) {
    setNotice(message);
    await reload();
  }

  function confirmComplete() {
    Alert.alert(
      'İş tamamlandı mı?',
      `${customer.fullName} müşterisinin taşıması bitti mi? Onaylarsan iş tamamlandı olarak kapanır ve müşteriden firmanı değerlendirmesi istenir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, tamamlandı',
          onPress: () =>
            void api
              .request(`/bookings/${booking!.id}/complete`, { method: 'POST' })
              .then(() => done('İş tamamlandı olarak işaretlendi.'))
              .catch((e: unknown) => Alert.alert('İşaretlenemedi', e instanceof Error ? e.message : 'Tekrar dene.')),
        },
      ],
    );
  }

  return (
    <DetailScreen backLabel="İşlerim" onRefresh={refresh}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>
          {customer.fullName}
        </AppText>
        <AppText weight="semibold" style={{ fontSize: 16 }}>
          {formatDate(booking.scheduledAt)}
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>{bookingRoute(r.from, r.to)}</AppText>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>

      {notice ? <Notice tone="info">{notice}</Notice> : null}
      {booking.status === 'CANCELLED' ? (
        <Notice tone="info">
          {`Bu iş iptal edildi${booking.cancelledAt ? ` (${formatDate(booking.cancelledAt)})` : ''}.${
            booking.cancelReason ? ` İptal nedeni: ${booking.cancelReason}` : ''
          }`}
        </Notice>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <QuickAction icon="call" label="Ara" onPress={() => void Linking.openURL(`tel:${customer.phone}`)} />
        <QuickAction
          icon="chatbubbles"
          label={unreadCount > 0 ? `Mesajlar (${unreadCount})` : 'Mesajlar'}
          highlight={unreadCount > 0}
          onPress={() => router.push({ pathname: '/is/[id]/mesajlar', params: { id: booking.id } })}
        />
        {booking.status === 'SCHEDULED' ? (
          <QuickAction icon="navigate" label="Yol tarifi" onPress={() => void Linking.openURL(directionsUrl(r.from, r.to))} />
        ) : null}
      </View>

      {booking.status === 'COMPLETED' ? (
        <Section
          title="Müşterinin değerlendirmesi"
          description={booking.review ? undefined : 'Müşteri henüz değerlendirme yapmadı; yaptığında burada görünür.'}
        >
          {booking.review ? <ReviewBlock review={booking.review} onReplied={() => done('Yanıtın yayımlandı.')} /> : null}
        </Section>
      ) : null}

      <Section title="İş bilgileri">
        <Row label="Müşteri">{customer.fullName}</Row>
        <Row label="Telefon">
          <AppText
            weight="semibold"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
            style={{ color: colors.brand700, textDecorationLine: 'underline' }}
          >
            {formatPhone(customer.phone)}
          </AppText>
        </Row>
        <Row label="Taşınma">{formatDate(booking.scheduledAt)}</Row>
        <Row label="Tutar">
          <AppText weight="semibold">{formatMoney(booking.priceTry)}</AppText>
        </Row>
        <Row label="Ev">{homeTypeLabel(r.homeType)}</Row>
        {r.routeKm != null ? <Row label="Yol">{distanceText({ ...r, distanceKm: null })}</Row> : null}
        {r.notes ? <Row label="Not">{r.notes}</Row> : null}
      </Section>

      <Section title="Adresler">
        <Stop title="Çıkış" place={r.from} />
        <View style={{ height: 1, backgroundColor: colors.zinc100 }} />
        <Stop title="Varış" place={r.to} />
      </Section>

      {booking.canComplete || booking.canCancel ? (
        <Section title="İşlemler">
          {booking.canComplete ? <Button title="İş tamamlandı" onPress={confirmComplete} /> : null}
          {booking.canCancel ? (
            <CancelForm
              bookingId={booking.id}
              consequence={`${customer.fullName} müşterisinin taşıması iptal edilecek ve müşteriye haber verilecek.`}
              placeholder="Örnek: Aracımız arızalandı, bu tarihte taşıma yapamıyoruz."
              onCancelled={() => done('İş iptal edildi, müşteriye haber verildi.')}
            />
          ) : null}
        </Section>
      ) : null}
    </DetailScreen>
  );
}

function Stop({ title, place }: { title: string; place: BookingPlace }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText weight="semibold" style={{ fontSize: 13, color: colors.zinc600 }}>
        {title}
      </AppText>
      <AppText>{place.address}</AppText>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
        {[place.cityName, place.districtName].filter(Boolean).join(', ')} · {floorLabel(place.floor)},{' '}
        {place.hasElevator ? 'asansörlü' : 'asansörsüz'}
      </AppText>
      <AppText
        weight="semibold"
        accessibilityRole="link"
        onPress={() => void Linking.openURL(mapUrl(place))}
        style={{ color: colors.brand700, fontSize: 14 }}
      >
        Haritada aç
      </AppText>
    </View>
  );
}
