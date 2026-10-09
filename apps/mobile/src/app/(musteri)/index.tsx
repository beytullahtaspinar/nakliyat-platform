import type { MovingRequest, Paginated } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { View } from 'react-native';
import { PanelScreen } from '@/components/panel';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { formatDate, placeLabel, REQUEST_STATUS } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { WEB_ORIGIN } from '@/lib/variant';
import { colors } from '@/theme';

const TONES = {
  info: { bg: colors.brand50, fg: colors.brand700 },
  success: { bg: colors.green50, fg: colors.green700 },
  warning: { bg: colors.accent50, fg: colors.accent700 },
  muted: { bg: colors.zinc100, fg: colors.zinc600 },
} as const;

/** Müşteri ana ekranı: taleplerim (sitedeki /hesabim karşılığı) */
export default function CustomerHome() {
  const { data, error, reload } = useApi<Paginated<MovingRequest>>('/requests?limit=50');

  return (
    <PanelScreen title="Taleplerim" onRefresh={reload}>
      {error ? <Notice>{error}</Notice> : null}
      {data && data.items.length === 0 ? (
        <Card>
          <AppText weight="semibold">Henüz talebin yok</AppText>
          <AppText style={{ color: colors.zinc600, marginTop: 4 }}>
            Taşınma bilgilerini gir, onaylı nakliyat firmaları sana teklif göndersin.
          </AppText>
        </Card>
      ) : null}
      {data?.items.map((r) => {
        const status = REQUEST_STATUS[r.status];
        const tone = TONES[status.tone];
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <AppText weight="semibold" style={{ flex: 1 }}>
                {placeLabel(r.fromCityName, r.fromDistrictName)} → {placeLabel(r.toCityName, r.toDistrictName)}
              </AppText>
              <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <AppText weight="medium" style={{ color: tone.fg, fontSize: 13 }}>
                  {status.label}
                </AppText>
              </View>
            </View>
            <AppText style={{ color: colors.zinc600, marginTop: 6 }}>
              {formatDate(r.moveDate)} · {r.quoteCount} teklif
            </AppText>
          </Card>
        );
      })}
      {/* Talep formu uygulamaya sonraki adımda gelecek; şimdilik sitedeki form açılır. */}
      <Button title="Yeni talep oluştur" kind="secondary" onPress={() => void Linking.openURL(`${WEB_ORIGIN}/talep-olustur`)} />
    </PanelScreen>
  );
}
