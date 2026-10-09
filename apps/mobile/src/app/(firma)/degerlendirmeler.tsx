import type { CompanyReviews } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DetailScreen, EmptyState } from '@/components/panel';
import { ReviewBlock } from '@/components/review';
import { AppText, Card, Notice, Segmented } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

const TABS = [
  { value: 'all', label: 'Tümü' },
  { value: 'unanswered', label: 'Yanıt bekleyen' },
  { value: 'answered', label: 'Yanıtlanan' },
  { value: 'hidden', label: 'Kaldırılan' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const QUERY: Record<Tab, string> = {
  all: '',
  unanswered: '&reply=unanswered',
  answered: '&reply=answered',
  hidden: '&status=hidden',
};

/** Sitedeki /firma-paneli/degerlendirmeler: puan özeti ve her yoruma bir kez yanıt */
export default function ReviewsScreen() {
  const [tab, setTab] = useState<Tab>('all');
  const { data, error, reload } = useApi<CompanyReviews>(`/company/reviews?limit=50${QUERY[tab]}`);
  const [notice, setNotice] = useState<string | null>(null);
  const summary = data?.summary;
  const replyRate = summary?.counts.total
    ? Math.round(((summary.counts.total - summary.counts.unanswered) / summary.counts.total) * 100)
    : null;

  return (
    <DetailScreen backLabel="Hesap" onRefresh={reload}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
        Değerlendirmeler
      </AppText>
      <AppText style={{ color: colors.zinc600 }}>Müşterilerinin puanları ve yorumları. Her yoruma bir kez yanıt verebilirsin.</AppText>
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}
      {summary ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <AppText weight="bold" style={{ fontSize: 32, lineHeight: 38 }}>
              {summary.ratingCount > 0 ? Number(summary.ratingAverage).toFixed(1).replace('.', ',') : '—'}
            </AppText>
            <AppText style={{ color: colors.zinc600, marginBottom: 5 }}>/ 5 · {summary.ratingCount} puan</AppText>
          </View>
          <View style={{ gap: 4, marginTop: 10 }}>
            {(['5', '4', '3', '2', '1'] as const).map((star) => {
              const n = summary.distribution[star];
              const ratio = summary.ratingCount ? n / summary.ratingCount : 0;
              return (
                <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={`${star} yıldız: ${n}`}>
                  <AppText style={{ width: 16, color: colors.zinc600, fontSize: 13 }}>{star}</AppText>
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.zinc100 }}>
                    <View style={{ width: `${ratio * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.amber500 }} />
                  </View>
                  <AppText style={{ width: 28, textAlign: 'right', color: colors.zinc600, fontSize: 13 }}>{n}</AppText>
                </View>
              );
            })}
          </View>
          <AppText style={{ color: colors.zinc600, marginTop: 10, fontSize: 14 }}>
            {summary.counts.unanswered > 0 ? `${summary.counts.unanswered} yorum yanıt bekliyor. ` : ''}
            {replyRate !== null ? `Yanıt oranın %${replyRate}.` : ''}
          </AppText>
        </Card>
      ) : null}
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {data ? (
        data.items.length === 0 ? (
          <EmptyState
            title="Değerlendirme yok"
            text={tab === 'all' ? 'İş tamamlandığında müşterinden puan ve yorum istenir; geldiğinde burada görünür.' : 'Bu süzgece uyan değerlendirme yok.'}
          />
        ) : (
          data.items.map((r) => (
            <Card key={r.id}>
              <View style={{ gap: 8 }}>
                <View>
                  <AppText
                    weight="semibold"
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/is/[id]', params: { id: r.bookingId } })}
                  >
                    {r.customerName}
                  </AppText>
                  <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>
                    {r.route} · {formatDate(r.moveDate)}
                  </AppText>
                </View>
                <ReviewBlock review={r} onReplied={async () => {
                  setNotice('Yanıtın yayımlandı.');
                  await reload();
                }} />
              </View>
            </Card>
          ))
        )
      ) : null}
    </DetailScreen>
  );
}
