import Ionicons from '@expo/vector-icons/Ionicons';
import type { MovingRequest, Paginated, RequestStatus, UnreadMessages } from '@nakliyat/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PanelScreen } from '@/components/panel';
import { PushPrompt } from '@/components/push-prompt';
import { AppText, Badge, Badges, Button, Notice, Segmented } from '@/components/ui';
import { formatDate, REQUEST_STATUS } from '@/lib/format';
import { homeTypeLabel, place } from '@/lib/requests';
import { useUser } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Aktif: firmayla süreci süren talepler; geçmiş: kapanmış olanlar (sitedeki /hesabim ile aynı) */
const ACTIVE: RequestStatus[] = ['DRAFT', 'OPEN', 'BOOKED'];

type Filter = 'aktif' | 'gecmis';

const route = (r: MovingRequest) => `${place(r.fromCityName, r.fromDistrictName)} → ${place(r.toCityName, r.toDistrictName)}`;
const detail = (r: MovingRequest, messages = false): Href => ({
  pathname: '/taleplerim/[id]',
  params: messages ? { id: r.id, mesajlar: '1' } : { id: r.id },
});

/** Müşteri ana ekranı: sıradaki adım, aktif ve geçmiş talepler (sitedeki /hesabim) */
export default function MyRequestsScreen() {
  const user = useUser();
  const { data, error, reload } = useApi<Paginated<MovingRequest>>('/requests?limit=50');
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const [chosen, setChosen] = useState<Filter | null>(null);

  const unreadByRequest = new Map((unread?.items ?? []).map((i) => [i.requestId, i.count]));
  const unreadFor = (id: string) => unreadByRequest.get(id) ?? 0;
  const items = data?.items ?? [];
  const active = items.filter((r) => ACTIVE.includes(r.status));
  const past = items.filter((r) => !ACTIVE.includes(r.status));
  // Seçim yapılmadıysa ve aktif talep yoksa geçmiş açılır
  const filter: Filter = chosen ?? (active.length === 0 && past.length > 0 ? 'gecmis' : 'aktif');
  const list = filter === 'gecmis' ? past : active;
  const hasDraft = active.some((r) => r.status === 'DRAFT');

  return (
    <PanelScreen title={`Merhaba ${user.fullName.split(' ')[0]}`} onRefresh={() => Promise.all([reload(), reloadUnread()])}>
      <AppText style={{ color: colors.zinc600, marginTop: -8 }}>Taşıma taleplerin, gelen teklifler ve firmalarla yazışmaların</AppText>
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
      {items.length ? <PushPrompt text="Yeni teklif ve mesaj geldiğinde haber verelim." /> : null}

      {data && items.length === 0 ? <FirstSteps /> : null}

      {items.length > 0 ? (
        <>
          <NextSteps requests={active} unreadFor={unreadFor} />
          <View style={{ gap: 10 }}>
            <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
              Taleplerim
            </AppText>
            <Segmented
              options={[
                { value: 'aktif', label: `Aktif (${active.length})` },
                { value: 'gecmis', label: `Geçmiş (${past.length})` },
              ]}
              value={filter}
              onChange={setChosen}
            />
          </View>
          {list.length === 0 ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.zinc300, backgroundColor: colors.white, padding: 20, gap: 12, alignItems: 'center' }}>
              <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>
                {filter === 'gecmis' ? 'Kapanmış talebin yok.' : 'Şu an süren bir talebin yok.'}
              </AppText>
              <Button title="Yeni talep oluştur" kind="secondary" icon="add" onPress={() => router.push('/teklif-al')} />
            </View>
          ) : (
            list.map((r) => <RequestCard key={r.id} request={r} messages={unreadFor(r.id)} />)
          )}
        </>
      ) : null}
    </PanelScreen>
  );
}

/** Bekleyen işler: okunmamış mesaj, karşılaştırılacak teklifler, yaklaşan taşınma */
function NextSteps({ requests, unreadFor }: { requests: MovingRequest[]; unreadFor: (id: string) => number }) {
  const steps: { key: string; to: Href; title: string; text: string }[] = [];
  for (const r of requests) {
    const unread = unreadFor(r.id);
    if (unread > 0) {
      steps.push({ key: `mesaj-${r.id}`, to: detail(r, true), title: `${unread} yeni mesaj`, text: `${route(r)} taşıman için firmadan` });
    }
    if (r.status === 'OPEN' && r.quoteCount > 0) {
      steps.push({
        key: `teklif-${r.id}`,
        to: detail(r),
        title: `${r.quoteCount} teklif geldi, karşılaştır`,
        text: `${route(r)} · teklif toplama ${formatDate(r.expiresAt)} tarihinde biter`,
      });
    } else if (r.status === 'BOOKED') {
      steps.push({
        key: `tasima-${r.id}`,
        to: detail(r),
        title: `Taşınman ${formatDate(r.moveDate)}`,
        text: `${route(r)} · firma bilgileri ve taşınma sonrası adımlar`,
      });
    }
  }
  if (steps.length === 0) return null;
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.accent100, backgroundColor: colors.accent50, padding: 16, gap: 10 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 16 }}>
        Sıradaki adım
      </AppText>
      {steps.slice(0, 3).map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          onPress={() => router.push(s.to)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.accent100,
            backgroundColor: pressed ? colors.zinc50 : colors.white,
            paddingHorizontal: 14,
            paddingVertical: 12,
          })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="semibold">{s.title}</AppText>
            <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>{s.text}</AppText>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.accent700} />
        </Pressable>
      ))}
    </View>
  );
}

function RequestCard({ request: r, messages }: { request: MovingRequest; messages: number }) {
  const status = REQUEST_STATUS[r.status];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(detail(r))}
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
          {route(r)}
        </AppText>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>
      <Badges>
        <Badge icon="home-outline">{homeTypeLabel(r.homeType)}</Badge>
        <Badge icon="calendar-outline">{formatDate(r.moveDate)}</Badge>
        {r.estimatedVolumeM3 ? <Badge icon="cube-outline">{`~${r.estimatedVolumeM3} m³`}</Badge> : null}
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
      {r.status === 'OPEN' && r.quoteCount === 0 ? (
        <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>{`Teklif toplama ${formatDate(r.expiresAt)} tarihinde biter`}</AppText>
      ) : null}
    </Pressable>
  );
}

/** Hiç talep yokken: üç adımda nasıl çalışır + teklif al */
function FirstSteps() {
  const steps = [
    ['Talebini oluştur', 'Nereden nereye, ne zaman taşınacağını yaz. 2 dakika sürer, ücretsiz.'],
    ['Teklifleri karşılaştır', 'Bölgendeki doğrulanmış firmalar fiyat verir; yorum ve puanlarını gör.'],
    ['Firmanı seç', 'Beğendiğin teklifi kabul et, firmayla buradan yazış.'],
  ];
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.zinc200, backgroundColor: colors.white, padding: 16, gap: 14 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
        Henüz talebin yok
      </AppText>
      {steps.map(([title, text], i) => (
        <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
            <AppText weight="bold" style={{ color: colors.brand700, fontSize: 14 }}>
              {i + 1}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="semibold">{title}</AppText>
            <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>{text}</AppText>
          </View>
        </View>
      ))}
      <Button title="Hemen ücretsiz teklif al" kind="accent" onPress={() => router.push('/teklif-al')} />
    </View>
  );
}
