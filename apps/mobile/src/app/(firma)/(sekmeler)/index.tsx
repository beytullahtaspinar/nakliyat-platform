import type { CompanyOverview } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { PanelScreen } from '@/components/panel';
import { AppText, Card, Notice } from '@/components/ui';
import { formatTry } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Firma panosu: sitedeki /firma-paneli özetinin mobil karşılığı */
export default function CompanyHome() {
  const { data, error, reload } = useApi<CompanyOverview>('/company/overview');

  return (
    <PanelScreen title="Pano" onRefresh={reload}>
      {error ? <Notice>{error}</Notice> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat
              label="Açık talep"
              value={data.requests.open}
              hint={`${data.requests.notQuoted} tanesine teklif vermedin`}
              highlight
              onPress={() => router.navigate('/talepler')}
            />
            <Stat label="Bekleyen teklif" value={data.quotes.pending} onPress={() => router.navigate('/teklifler')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat label="Planlı iş" value={data.bookings.scheduled} hint={`${data.bookings.next7Days} tanesi 7 gün içinde`} />
            <Stat label="Tamamlanan" value={data.bookings.completed} />
          </View>
          <Card>
            <AppText style={{ color: colors.zinc600 }}>Bu ayki iş tutarı</AppText>
            <AppText weight="bold" style={{ fontSize: 26, lineHeight: 32, marginTop: 4 }}>
              {formatTry(data.revenue.thisMonthTry)}
            </AppText>
            <AppText style={{ color: colors.zinc600, marginTop: 4 }}>Geçen ay: {formatTry(data.revenue.lastMonthTry)}</AppText>
          </Card>
          <Card>
            <AppText style={{ color: colors.zinc600 }}>Müşteri puanı</AppText>
            <AppText weight="bold" style={{ fontSize: 26, lineHeight: 32, marginTop: 4 }}>
              {data.rating.count > 0 ? data.rating.average.toFixed(1).replace('.', ',') : '—'}
            </AppText>
            <AppText style={{ color: colors.zinc600, marginTop: 4 }}>{data.rating.count} değerlendirme</AppText>
          </Card>
        </>
      ) : null}
    </PanelScreen>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
  onPress,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 16,
        padding: 16,
        backgroundColor: highlight ? colors.brand700 : colors.white,
        borderWidth: highlight ? 0 : 1,
        borderColor: colors.zinc200,
      }}
    >
      <AppText style={{ color: highlight ? colors.brand100 : colors.zinc600 }}>{label}</AppText>
      <AppText weight="bold" style={{ fontSize: 30, lineHeight: 36, color: highlight ? colors.white : colors.zinc900 }}>
        {value}
      </AppText>
      {hint ? <AppText style={{ fontSize: 13, lineHeight: 18, color: highlight ? colors.brand100 : colors.zinc500 }}>{hint}</AppText> : null}
    </Pressable>
  );
}
