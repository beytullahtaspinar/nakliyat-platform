import type { CompanyCustomer, Paginated } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen, EmptyState } from '@/components/panel';
import { AppText, Badge, Field, Notice } from '@/components/ui';
import { BOOKING_STATUS, bookingRoute, formatPhone } from '@/lib/bookings';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Sitedeki /firma-paneli/musteriler: teklifini kabul eden müşteriler */
export default function CustomersScreen() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, reload } = useApi<Paginated<CompanyCustomer>>(
    `/company/customers?limit=50${search ? `&q=${encodeURIComponent(search)}` : ''}`,
  );

  return (
    <DetailScreen backLabel="Hesap" onRefresh={reload}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
        Müşteriler
      </AppText>
      <AppText style={{ color: colors.zinc600 }}>Teklifini kabul eden müşterilerin. Tutar, iptal edilmeyen işlerin toplamıdır.</AppText>
      <Field
        label="Ara"
        value={q}
        onChangeText={setQ}
        placeholder="Müşteri adı ya da telefonu"
        returnKeyType="search"
        onSubmitEditing={() => setSearch(q.trim())}
        onBlur={() => setSearch(q.trim())}
      />
      {error ? <Notice>{error}</Notice> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState
            title={search ? 'Sonuç yok' : 'Henüz müşterin yok'}
            text={search ? 'Bu aramaya uyan müşteri yok.' : 'Teklifin kabul edildiğinde müşteri burada listelenir.'}
          />
        ) : (
          data.items.map((c) => {
            const status = BOOKING_STATUS[c.lastBooking.status];
            return (
              <View key={c.phone} style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.zinc200, padding: 16, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <AppText weight="semibold" style={{ flex: 1, fontSize: 16 }}>
                    {c.fullName}
                  </AppText>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </View>
                <AppText
                  weight="semibold"
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(`tel:${c.phone}`)}
                  style={{ color: colors.brand700 }}
                >
                  {formatPhone(c.phone)}
                </AppText>
                <AppText style={{ color: colors.zinc600, fontSize: 14 }}>
                  {c.bookingCount} iş{c.activeCount > 0 ? ` (${c.activeCount} planlı)` : ''} · {formatMoney(c.totalTry)}
                </AppText>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/is/[id]', params: { id: c.lastBooking.id } })}
                >
                  <AppText style={{ color: colors.zinc600, fontSize: 14 }}>
                    Son taşınma: <AppText weight="semibold" style={{ color: colors.brand700, fontSize: 14 }}>{formatDate(c.lastBooking.scheduledAt)}</AppText>
                  </AppText>
                  <AppText style={{ color: colors.zinc500, fontSize: 13 }}>{bookingRoute(c.lastBooking.from, c.lastBooking.to)}</AppText>
                </Pressable>
              </View>
            );
          })
        )
      ) : null}
    </DetailScreen>
  );
}
