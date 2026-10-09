import Ionicons from '@expo/vector-icons/Ionicons';
import type { BookingStatus, CompanyBooking, Paginated, UnreadMessages } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EmptyState, PanelScreen } from '@/components/panel';
import { AppText, Badge, Notice, Segmented } from '@/components/ui';
import { BOOKING_STATUS, bookingRoute } from '@/lib/bookings';
import { formatDate } from '@/lib/format';
import { formatMoney, homeTypeLabel } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

const FILTERS = [
  { value: 'SCHEDULED', label: 'Planlanan' },
  { value: 'COMPLETED', label: 'Tamamlanan' },
  { value: 'CANCELLED', label: 'İptal edilen' },
  { value: 'all', label: 'Tümü' },
] as const satisfies readonly { value: BookingStatus | 'all'; label: string }[];

type Filter = (typeof FILTERS)[number]['value'];

const EMPTY: Record<Filter, { title: string; text: string }> = {
  SCHEDULED: { title: 'Planlanmış iş yok', text: 'Müşteri teklifini kabul edince iş burada görünür.' },
  COMPLETED: { title: 'Tamamlanan iş yok', text: 'Taşıma bitince işi tamamlandı olarak işaretleyebilirsin.' },
  CANCELLED: { title: 'İptal edilen iş yok', text: 'İptal edilen işler burada listelenir.' },
  all: { title: 'Henüz işin yok', text: 'Teklifin kabul edildiğinde müşterinin bilgileri ve adresi burada açılır.' },
};

/** Sitedeki /firma-paneli/isler: anlaşılan işler, müşteri bilgileri ve okunmamış mesajlar */
export default function BookingsScreen() {
  const [filter, setFilter] = useState<Filter>('SCHEDULED');
  const { data, error, reload } = useApi<Paginated<CompanyBooking>>(
    `/company/bookings?limit=50${filter === 'all' ? '' : `&status=${filter}`}`,
  );
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const unreadOf = (id: string) => unread?.items.find((i) => i.bookingId === id)?.count ?? 0;

  return (
    <PanelScreen title="İşlerim" onRefresh={() => Promise.all([reload(), reloadUnread()])}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/takvim')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.zinc200,
          backgroundColor: pressed ? colors.zinc100 : colors.white,
        })}
      >
        <Ionicons name="calendar-outline" size={22} color={colors.brand700} />
        <AppText weight="semibold" style={{ flex: 1 }}>
          Takvim
        </AppText>
        <Ionicons name="chevron-forward" size={20} color={colors.zinc500} />
      </Pressable>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {error ? <Notice>{error}</Notice> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState {...EMPTY[filter]} />
        ) : (
          data.items.map((b) => <BookingCard key={b.id} booking={b} unread={unreadOf(b.id)} />)
        )
      ) : null}
    </PanelScreen>
  );
}

function BookingCard({ booking: b, unread }: { booking: CompanyBooking; unread: number }) {
  const status = BOOKING_STATUS[b.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="İşin ayrıntısını ve mesajları açar"
      onPress={() => router.push({ pathname: '/is/[id]', params: { id: b.id } })}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.zinc100 : colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.zinc200,
        padding: 16,
        gap: 6,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <AppText weight="semibold" style={{ flex: 1, fontSize: 16 }}>
          {b.customer.fullName}
        </AppText>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>
      <AppText weight="bold" style={{ fontSize: 17 }}>
        {formatDate(b.scheduledAt)}
      </AppText>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>{bookingRoute(b.request.from, b.request.to)}</AppText>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
        {homeTypeLabel(b.request.homeType)} · {formatMoney(b.priceTry)}
      </AppText>
      {unread > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="chatbubbles" size={16} color={colors.accent700} />
          <AppText weight="semibold" style={{ color: colors.accent700, fontSize: 14 }}>
            {unread} yeni mesaj
          </AppText>
        </View>
      ) : null}
      {b.status === 'CANCELLED' && b.cancelReason ? (
        <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>İptal nedeni: {b.cancelReason}</AppText>
      ) : null}
    </Pressable>
  );
}
