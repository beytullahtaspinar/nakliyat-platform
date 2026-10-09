import type { CompanyRequest, Paginated } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EmptyState, PanelScreen } from '@/components/panel';
import { AppText, Badge, Notice, Segmented } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { distanceText, homeTypeLabel, quoteBadgeText, QUOTE_STATUS, requestFlags, route } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

const FILTERS = [
  { value: 'no', label: 'Yeni' },
  { value: 'yes', label: 'Teklif verdiklerim' },
  { value: 'all', label: 'Tümü' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const EMPTY: Record<Filter, { title: string; text: string }> = {
  no: { title: 'Yeni talep yok', text: 'Hizmet verdiğin illerde teklif vermediğin açık talep kalmadı.' },
  yes: { title: 'Henüz teklif vermedin', text: 'Teklif verdiğin açık talepler burada görünür.' },
  all: { title: 'Açık talep yok', text: 'Hizmet verdiğin illerde şu an açık talep bulunmuyor.' },
};

const LIMIT = 50;

/** Sitedeki /firma-paneli/talepler: hizmet bölgesindeki açık talepler, taşınma tarihine göre */
export default function RequestsScreen() {
  const [filter, setFilter] = useState<Filter>('no');
  const { data, error, reload } = useApi<Paginated<CompanyRequest>>(
    `/company/requests?limit=${LIMIT}${filter === 'all' ? '' : `&quoted=${filter}`}`,
  );

  return (
    <PanelScreen title="Gelen talepler" onRefresh={reload}>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {error ? <Notice>{error}</Notice> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState {...EMPTY[filter]} />
        ) : (
          <>
            {data.items.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
            {data.total > data.items.length ? (
              <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>
                Taşınma tarihi en yakın {data.items.length} talep gösteriliyor (toplam {data.total}).
              </AppText>
            ) : null}
          </>
        )
      ) : null}
    </PanelScreen>
  );
}

function RequestCard({ request: r }: { request: CompanyRequest }) {
  const flags = requestFlags(r).slice(0, 4);
  const facts = [homeTypeLabel(r.homeType), `${formatDate(r.moveDate)}${r.isDateFlexible ? ' (esnek)' : ''}`, distanceText(r)];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Talebin ayrıntısını ve teklif formunu açar"
      onPress={() => router.push({ pathname: '/talep/[id]', params: { id: r.id } })}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.zinc100 : colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.zinc200,
        padding: 16,
        gap: 8,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <AppText weight="semibold" style={{ flex: 1, fontSize: 16 }}>
          {route(r)}
        </AppText>
        {r.myQuote ? (
          <Badge tone={QUOTE_STATUS[r.myQuote.status].tone}>{quoteBadgeText(r.myQuote)}</Badge>
        ) : (
          <Badge tone="accent">Yeni</Badge>
        )}
      </View>
      <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>{facts.join(' · ')}</AppText>
      {flags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {flags.map((f) => (
            <Badge key={f.key} tone={f.tone}>
              {f.label}
            </Badge>
          ))}
        </View>
      ) : null}
      <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>
        {r.quoteCount === 0 ? 'Henüz teklif veren yok' : `${r.quoteCount} firma teklif verdi`}
      </AppText>
    </Pressable>
  );
}
