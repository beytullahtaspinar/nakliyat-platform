import Ionicons from '@expo/vector-icons/Ionicons';
import type { CompanyProfile, CompanyRequestDetail, RequestMedia } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { QuoteForm } from '@/components/quote-form';
import { AppText, Badge, Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  daysText,
  daysUntil,
  distanceText,
  floorLabel,
  formatCredits,
  formatMoney,
  homeTypeLabel,
  isHeavyFloor,
  place,
  QUOTE_STATUS,
  quoteBadgeText,
  requestFlags,
  route,
  VEHICLE_LABELS,
  type RequestFlag,
} from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Dikkat kutusunda her işaretin açıklaması: firma neden önemli olduğunu tek satırda görsün */
function flagHint(flag: RequestFlag, request: CompanyRequestDetail): string | null {
  switch (flag.key) {
    case 'acil':
      return 'Ekip ve aracını bu tarihe ayırabileceğinden emin ol.';
    case 'cikis-kat':
    case 'varis-kat':
      return 'Eşyalar merdivenden taşınacak; ekip ve süreyi buna göre hesapla.';
    case 'ozel':
      return request.specialItems.join(', ');
    case 'Paketleme':
      return 'Müşteri eşyalarının paketlenmesini istiyor.';
    case 'Söküm/kurulum':
      return 'Müşteri mobilyaların sökülüp kurulmasını istiyor.';
    case 'Depolama':
      return 'Müşteri eşyaların bir süre depoda kalmasını istiyor.';
    default:
      return null;
  }
}

/** Sitedeki /firma-paneli/talepler/[id]: talep ayrıntısı ve teklif formu */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: request, error, reload } = useApi<CompanyRequestDetail>(`/company/requests/${encodeURIComponent(id)}`);
  const { data: profile, reload: reloadProfile } = useApi<CompanyProfile>('/company/profile');
  const [notice, setNotice] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const refresh = () => Promise.all([reload(), reloadProfile()]);

  if (!request) {
    return (
      <DetailScreen backLabel="Geri" onRefresh={refresh}>
        {error ? <Notice>{error}</Notice> : <AppText style={{ color: colors.zinc600 }}>Talep yükleniyor…</AppText>}
      </DetailScreen>
    );
  }

  const quote = request.myQuote;
  const open = request.status === 'OPEN' && new Date(request.expiresAt) > new Date();
  const verified = profile?.verificationStatus === 'VERIFIED';
  const attention = requestFlags(request).filter(
    (f) => !['not', 'medya', 'sehirlerarasi'].includes(f.key) && (open || f.key !== 'acil'),
  );
  const ends = [
    { key: 'cikis', title: 'Çıkış', city: request.fromCityName, district: request.fromDistrictName, floor: request.fromFloor, elevator: request.fromHasElevator },
    { key: 'varis', title: 'Varış', city: request.toCityName, district: request.toDistrictName, floor: request.toFloor, elevator: request.toHasElevator },
  ];
  const facts = [
    {
      label: 'Taşınma tarihi',
      value: formatDate(request.moveDate),
      hint: [open ? daysText(daysUntil(request.moveDate)) : null, request.isDateFlexible ? 'tarih esnek' : 'tarih kesin'].filter(Boolean).join(' · '),
    },
    {
      label: 'Ev tipi',
      value: homeTypeLabel(request.homeType),
      hint: request.estimatedVolumeM3 ? `yaklaşık ${request.estimatedVolumeM3} m³ eşya` : null,
    },
    { label: 'Yol', value: distanceText(request), hint: request.fromCityCode !== request.toCityCode ? 'şehirler arası' : null },
    {
      label: 'Önerilen ekip',
      value: request.estimatedCrew ? `${request.estimatedCrew} kişi` : '—',
      hint: request.estimatedHours ? `yaklaşık ${request.estimatedHours} saat` : null,
    },
  ];
  const services = [
    { label: 'Paketleme', wanted: request.needsPacking },
    { label: 'Mobilya söküm ve kurulumu', wanted: request.needsAssembly },
    { label: 'Depolama', wanted: request.needsStorage },
  ];

  async function saved(message: string) {
    setNotice(message);
    await reload();
  }

  function confirmWithdraw(quoteId: string, creditCost: number) {
    Alert.alert(
      'Teklifi geri çek',
      `Teklifin müşterinin listesinden kalkacak ve bu talebe yeniden teklif veremeyeceksin.${
        creditCost > 0 ? ` Bu teklif için düşülen ${formatCredits(creditCost)} iade edilmez.` : ''
      }`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, geri çek',
          style: 'destructive',
          onPress: () => {
            setWithdrawing(true);
            api
              .request(`/company/quotes/${quoteId}/withdraw`, { method: 'POST' })
              .then(() => saved('Teklifin geri çekildi.'))
              .catch((e: unknown) => Alert.alert('Geri çekilemedi', e instanceof Error ? e.message : 'Tekrar dene.'))
              .finally(() => setWithdrawing(false));
          },
        },
      ],
    );
  }

  return (
    <DetailScreen backLabel="Talepler" onRefresh={refresh}>
      <View style={{ gap: 8 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>
          {route(request)}
        </AppText>
        <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>
          Talep {formatDate(request.createdAt)} tarihinde açıldı · {request.quoteCount} firma teklif verdi
        </AppText>
        {quote ? (
          <Badge tone={QUOTE_STATUS[quote.status].tone}>{quoteBadgeText(quote)}</Badge>
        ) : open ? (
          <Badge tone="accent">Yeni</Badge>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {facts.map((f) => (
          <View
            key={f.label}
            style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.zinc200, padding: 12 }}
          >
            <AppText weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: colors.zinc600 }}>
              {f.label}
            </AppText>
            <AppText weight="bold" style={{ fontSize: 16, marginTop: 2 }}>
              {f.value}
            </AppText>
            {f.hint ? <AppText style={{ fontSize: 13, lineHeight: 18, color: colors.zinc600 }}>{f.hint}</AppText> : null}
          </View>
        ))}
      </View>

      {attention.length > 0 ? (
        <View style={{ backgroundColor: colors.amber50, borderColor: colors.amber300, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }}>
          <AppText weight="semibold" style={{ color: colors.amber900 }}>
            Fiyatı etkileyenler: teklif vermeden önce bak
          </AppText>
          {attention.map((f) => {
            const hint = flagHint(f, request);
            return (
              <View key={f.key} style={{ flexDirection: 'row', gap: 10 }}>
                <Ionicons name="alert-circle" size={20} color={colors.amber500} />
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" style={{ color: colors.amber900 }}>
                    {f.key === 'ozel' ? 'Özel eşya' : f.label}
                  </AppText>
                  {hint ? <AppText style={{ color: colors.amber900, fontSize: 14, lineHeight: 20 }}>{hint}</AppText> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Section title="Çıkış ve varış" description="Müşterinin adı, telefonu ve açık adresi teklifini kabul ettiğinde açılır.">
        {ends.map((e) => (
          <View key={e.key} style={{ gap: 4 }}>
            <AppText weight="semibold" style={{ fontSize: 12, color: colors.zinc600 }}>
              {e.title}
            </AppText>
            <AppText weight="semibold">{place(e.city, e.district)}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText>{floorLabel(e.floor)}</AppText>
              <Badge tone={e.elevator ? 'success' : isHeavyFloor(e.floor, e.elevator) ? 'warning' : 'neutral'}>
                {e.elevator ? 'Asansör var' : 'Asansör yok'}
              </Badge>
            </View>
          </View>
        ))}
      </Section>

      <Section title="İstenen hizmetler ve eşyalar">
        {services.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={s.wanted ? 'checkmark-circle' : 'close-circle'} size={20} color={s.wanted ? colors.accent500 : colors.zinc300} />
            <AppText weight={s.wanted ? 'semibold' : 'regular'} style={{ color: s.wanted ? colors.zinc900 : colors.zinc600 }}>
              {s.label}
              {s.wanted ? '' : ' (istemiyor)'}
            </AppText>
          </View>
        ))}
        <AppText weight="semibold" style={{ marginTop: 4 }}>
          Özel eşyalar
        </AppText>
        {request.specialItems.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {request.specialItems.map((item) => (
              <Badge key={item} tone="warning">
                {item}
              </Badge>
            ))}
          </View>
        ) : (
          <AppText style={{ color: colors.zinc600 }}>Müşteri özel eşya belirtmedi.</AppText>
        )}
      </Section>

      <Section title="Müşteri notu">
        <AppText style={{ color: request.notes ? colors.zinc900 : colors.zinc600 }}>{request.notes || 'Müşteri not eklemedi.'}</AppText>
      </Section>

      <Section title={`Fotoğraf ve videolar (${request.media.length})`}>
        {request.media.length > 0 ? <MediaStrip media={request.media} /> : <AppText style={{ color: colors.zinc600 }}>Müşteri fotoğraf veya video eklemedi.</AppText>}
      </Section>

      <Section
        title={quote ? 'Teklifin' : 'Teklif ver'}
        description={open ? `Son teklif günü ${formatDate(request.expiresAt)} (${daysText(daysUntil(request.expiresAt))})` : undefined}
      >
        {notice ? <Notice tone="info">{notice}</Notice> : null}
        {quote && quote.status !== 'PENDING' ? (
          <AppText>
            {formatMoney(quote.priceTry)} · {VEHICLE_LABELS[quote.vehicleType]} · {quote.crewSize} kişi
          </AppText>
        ) : !open ? (
          <AppText style={{ color: colors.zinc600 }}>Bu talep artık teklif kabul etmiyor.</AppText>
        ) : !profile ? null : !verified ? (
          <AppText style={{ color: colors.zinc600 }}>Firman doğrulandıktan sonra bu talebe teklif verebilirsin.</AppText>
        ) : (
          <>
            {/* Kayıttan sonra form yeni değerlerle açılsın */}
            <QuoteForm key={quote ? `${quote.id}:${quote.priceTry}:${quote.vehicleType}:${quote.crewSize}` : 'yeni'} request={request} quote={quote} onSaved={saved} />
            {quote ? (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.zinc200, paddingTop: 12 }}>
                <Button title="Teklifi geri çek" kind="secondary" loading={withdrawing} onPress={() => confirmWithdraw(quote.id, quote.creditCost)} />
              </View>
            ) : null}
          </>
        )}
      </Section>
    </DetailScreen>
  );
}

/** Fotoğraflar küçük resim; dokununca tam boy (videolar dahil) tarayıcıda açılır */
function MediaStrip({ media }: { media: RequestMedia[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {media.map((m, i) => (
        <Pressable
          key={m.id}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${m.type === 'VIDEO' ? 'Video' : 'Fotoğraf'} ${i + 1}, büyük aç`}
          onPress={() => void Linking.openURL(m.url)}
          style={{ width: 112, height: 112, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.zinc100, alignItems: 'center', justifyContent: 'center' }}
        >
          {m.type === 'PHOTO' ? (
            <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Ionicons name="play-circle" size={40} color={colors.brand700} />
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
