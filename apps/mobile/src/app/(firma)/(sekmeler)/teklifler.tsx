import type { CompanyQuote, Paginated } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EmptyState, PanelScreen } from '@/components/panel';
import { AppText, Badge, Notice, Segmented } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatMoney, QUOTE_STATUS, route, VEHICLE_LABELS } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

const FILTERS = [
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'ACCEPTED', label: 'Kabul edilen' },
  { value: 'all', label: 'Tümü' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const EMPTY: Record<Filter, { title: string; text: string }> = {
  PENDING: { title: 'Bekleyen teklifin yok', text: 'Gelen talepler sekmesinden yeni taleplere teklif verebilirsin.' },
  ACCEPTED: { title: 'Kabul edilen teklif yok', text: 'Müşteri teklifini kabul edince burada görünür.' },
  all: { title: 'Henüz teklif vermedin', text: 'Verdiğin bütün teklifler burada listelenir.' },
};

/** Sitedeki /firma-paneli/teklifler: verilen teklifler, en yenisi üstte */
export default function QuotesScreen() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const { data, error, reload } = useApi<Paginated<CompanyQuote>>(
    `/company/quotes?limit=50${filter === 'all' ? '' : `&status=${filter}`}`,
  );

  return (
    <PanelScreen title="Tekliflerim" onRefresh={reload}>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {error ? <Notice>{error}</Notice> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState {...EMPTY[filter]} />
        ) : (
          data.items.map((q) => <QuoteCard key={q.id} quote={q} />)
        )
      ) : null}
    </PanelScreen>
  );
}

function QuoteCard({ quote: q }: { quote: CompanyQuote }) {
  const status = QUOTE_STATUS[q.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Talebi ve teklifini açar"
      onPress={() => router.push({ pathname: '/talep/[id]', params: { id: q.requestId } })}
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
          {route(q.request)}
        </AppText>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>
      <AppText weight="bold" style={{ fontSize: 20, lineHeight: 26 }}>
        {formatMoney(q.priceTry)}
      </AppText>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
        Taşınma {formatDate(q.request.moveDate)} · {VEHICLE_LABELS[q.vehicleType]} · {q.crewSize} kişi
      </AppText>
      <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>Teklif tarihi {formatDate(q.createdAt)}</AppText>
    </Pressable>
  );
}
