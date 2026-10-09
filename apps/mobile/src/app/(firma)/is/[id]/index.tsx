import Ionicons from '@expo/vector-icons/Ionicons';
import type { BookingPlace, CompanyBooking, UnreadMessages } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { ReviewBlock } from '@/components/review';
import { AppText, Badge, Button, Field, Notice } from '@/components/ui';
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
              onCancelled={() => done('İş iptal edildi, müşteriye haber verildi.')}
            />
          ) : null}
        </Section>
      ) : null}
    </DetailScreen>
  );
}

function QuickAction({
  icon,
  label,
  highlight,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: highlight ? colors.accent500 : colors.zinc200,
        backgroundColor: pressed ? colors.zinc100 : highlight ? colors.accent50 : colors.white,
      })}
    >
      <Ionicons name={icon} size={22} color={highlight ? colors.accent700 : colors.brand700} />
      <AppText weight="semibold" style={{ fontSize: 13, color: highlight ? colors.accent700 : colors.brand700 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <AppText style={{ width: 80, color: colors.zinc500 }}>{label}</AppText>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <AppText>{children}</AppText> : children}</View>
    </View>
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

/** İptal gerekçeyle yapılır; önce düğmeyle açılır */
function CancelForm({ bookingId, consequence, onCancelled }: { bookingId: string; consequence: string; onCancelled: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return <Button title="İşi iptal et" kind="secondary" onPress={() => setOpen(true)} />;

  async function submit() {
    if (reason.trim().length < 5) return setError('İptal nedenini en az 5 karakterle yaz.');
    setError(null);
    setSaving(true);
    try {
      await api.request(`/bookings/${bookingId}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      await onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İptal edilemedi, tekrar dene.');
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 10, backgroundColor: colors.red50, borderRadius: 12, padding: 12 }}>
      <AppText style={{ color: colors.red700 }}>{consequence}</AppText>
      <Field
        label="İptal nedeni"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        placeholder="Örnek: Aracımız arızalandı, bu tarihte taşıma yapamıyoruz."
        style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {error ? <Notice>{error}</Notice> : null}
      <Button
        title="İşi iptal et"
        loading={saving}
        onPress={() =>
          Alert.alert('İşi iptal et', 'Bu işlem geri alınamaz.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Evet, iptal et', style: 'destructive', onPress: () => void submit() },
          ])
        }
      />
      <Button title="Vazgeç" kind="secondary" onPress={() => setOpen(false)} />
    </View>
  );
}
