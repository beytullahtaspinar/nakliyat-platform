import type { MovingRequest, Paginated, UnreadMessages } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { EmptyState, PanelScreen } from '@/components/panel';
import { PushPrompt } from '@/components/push-prompt';
import { AppText, Badge, Badges, Button, Notice } from '@/components/ui';
import { formatDate, REQUEST_STATUS } from '@/lib/format';
import { homeTypeLabel, place } from '@/lib/requests';
import { useUser } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Müşteri ana ekranı: taleplerim (sitedeki /hesabim) */
export default function MyRequestsScreen() {
  const user = useUser();
  const { data, error, reload } = useApi<Paginated<MovingRequest>>('/requests?limit=50');
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');

  const unreadByRequest = new Map((unread?.items ?? []).map((i) => [i.requestId, i.count]));
  const hasDraft = data?.items.some((r) => r.status === 'DRAFT');

  return (
    <PanelScreen title="Taleplerim" onRefresh={() => Promise.all([reload(), reloadUnread()])}>
      {error ? <Notice>{error}</Notice> : null}
      {hasDraft && !user.verified ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/dogrulama')}
          style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.amber300, backgroundColor: colors.amber50, padding: 16, gap: 4 }}
        >
          <AppText weight="semibold" style={{ color: colors.amber900 }}>
            Talebin firmalara gönderilmeyi bekliyor
          </AppText>
          <AppText style={{ color: colors.amber900, fontSize: 14, lineHeight: 20 }}>
            Hesabını doğrulayınca talebin yayına girer ve firmalar teklif vermeye başlar. Doğrulamak için dokun.
          </AppText>
        </Pressable>
      ) : null}
      {data?.items.length ? <PushPrompt text="Yeni teklif ve mesaj geldiğinde haber verelim." /> : null}

      {data && data.items.length === 0 ? (
        <View style={{ gap: 12 }}>
          <EmptyState title="Henüz talebin yok" text="Taşınma bilgilerini gir, onaylı nakliyat firmaları sana ücretsiz teklif göndersin." />
          <Button title="Teklif al" onPress={() => router.push('/teklif-al')} />
        </View>
      ) : null}

      {data?.items.map((r) => {
        const status = REQUEST_STATUS[r.status];
        const messages = unreadByRequest.get(r.id) ?? 0;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/taleplerim/[id]', params: { id: r.id } })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.zinc100 : colors.white,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.zinc200,
              padding: 16,
              gap: 10,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <AppText weight="semibold" style={{ flex: 1, fontSize: 16 }}>
                {place(r.fromCityName, r.fromDistrictName)} → {place(r.toCityName, r.toDistrictName)}
              </AppText>
              <Badge tone={status.tone}>{status.label}</Badge>
            </View>
            <Badges>
              <Badge icon="home-outline">{homeTypeLabel(r.homeType)}</Badge>
              <Badge icon="calendar-outline">{formatDate(r.moveDate)}</Badge>
              {r.status === 'OPEN' || r.quoteCount > 0 ? (
                <Badge icon="pricetags-outline" tone={r.quoteCount > 0 ? 'brand' : 'neutral'}>
                  {r.quoteCount > 0 ? `${r.quoteCount} teklif` : 'Teklif bekleniyor'}
                </Badge>
              ) : null}
              {messages > 0 ? (
                <Badge icon="chatbubble" tone="accent">
                  {`${messages} yeni mesaj`}
                </Badge>
              ) : null}
            </Badges>
          </Pressable>
        );
      })}
    </PanelScreen>
  );
}
