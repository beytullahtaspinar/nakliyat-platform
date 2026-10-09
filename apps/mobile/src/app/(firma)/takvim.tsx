import Ionicons from '@expo/vector-icons/Ionicons';
import type { CompanyCalendar } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen } from '@/components/panel';
import { AppText, Badge, Notice } from '@/components/ui';
import { BOOKING_STATUS } from '@/lib/bookings';
import { formatDayTitle, formatMonth, monthGrid, shiftMonth, todayInTurkey, WEEKDAYS_SHORT } from '@/lib/calendar';
import { formatMoney, homeTypeLabel } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

type Job = CompanyCalendar['items'][number];

const city = (p: Job['from']) => p.districtName ?? p.cityName ?? '';
const routeShort = (j: Job) =>
  j.from.cityName === j.to.cityName ? `${city(j.from)} → ${city(j.to)}` : `${j.from.cityName} → ${j.to.cityName}`;

/** Sitedeki /firma-paneli/takvim: ay görünümü, seçilen günün işleri altta */
export default function CalendarScreen() {
  const today = todayInTurkey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const days = monthGrid(month);
  const { data, error, reload } = useApi<CompanyCalendar>(`/company/bookings/calendar?from=${days[0]}&to=${days.at(-1)}`);

  const byDay = new Map<string, Job[]>();
  for (const job of data?.items ?? []) byDay.set(job.day, [...(byDay.get(job.day) ?? []), job]);
  const jobs = byDay.get(selected) ?? [];

  function go(by: number) {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  }

  return (
    <DetailScreen backLabel="İşlerim" onRefresh={reload}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MonthButton icon="chevron-back" label="Önceki ay" onPress={() => go(-1)} />
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 20 }}>
          {formatMonth(month)}
        </AppText>
        <MonthButton icon="chevron-forward" label="Sonraki ay" onPress={() => go(1)} />
      </View>
      {error ? <Notice>{error}</Notice> : null}

      <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.zinc200, padding: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map((d) => (
            <AppText key={d} weight="semibold" style={{ flex: 1, textAlign: 'center', fontSize: 12, color: colors.zinc500 }}>
              {d}
            </AppText>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map((day) => {
            const inMonth = day.startsWith(month);
            const count = (byDay.get(day) ?? []).filter((j) => j.status !== 'CANCELLED').length;
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatDayTitle(day)}${count ? `, ${count} iş` : ''}`}
                onPress={() => setSelected(day)}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? colors.brand700 : 'transparent',
                    borderWidth: isToday && !isSelected ? 1 : 0,
                    borderColor: colors.brand700,
                  }}
                >
                  <AppText
                    weight={isToday || isSelected ? 'bold' : 'regular'}
                    style={{ color: isSelected ? colors.white : inMonth ? colors.zinc900 : colors.zinc300 }}
                  >
                    {Number(day.slice(8))}
                  </AppText>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      marginTop: 2,
                      backgroundColor: count ? (isSelected ? colors.white : colors.accent500) : 'transparent',
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AppText weight="bold" style={{ fontSize: 18 }}>
        {formatDayTitle(selected)}
      </AppText>
      {data && jobs.length === 0 ? <AppText style={{ color: colors.zinc600 }}>Bu gün için iş yok.</AppText> : null}
      {jobs.map((j) => (
        <Pressable
          key={j.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/is/[id]', params: { id: j.id } })}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.zinc100 : colors.white,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.zinc200,
            padding: 14,
            gap: 4,
            opacity: j.status === 'CANCELLED' ? 0.6 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <AppText weight="semibold" style={{ flex: 1 }}>
              {j.customerName}
            </AppText>
            <Badge tone={BOOKING_STATUS[j.status].tone}>{BOOKING_STATUS[j.status].label}</Badge>
          </View>
          <AppText style={{ color: colors.zinc600, fontSize: 14 }}>{routeShort(j)}</AppText>
          <AppText style={{ color: colors.zinc600, fontSize: 14 }}>
            {homeTypeLabel(j.homeType)} · {formatMoney(j.priceTry)}
          </AppText>
        </Pressable>
      ))}
    </DetailScreen>
  );
}

function MonthButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.zinc200 }}
    >
      <Ionicons name={icon} size={20} color={colors.brand700} />
    </Pressable>
  );
}
