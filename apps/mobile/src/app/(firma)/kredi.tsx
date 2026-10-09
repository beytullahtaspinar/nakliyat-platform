import type { CompanyCreditSummary, CreditTransaction, CreditTransactionType, Paginated } from '@nakliyat/api-client';
import { View } from 'react-native';
import { DetailScreen, EmptyState, Section } from '@/components/panel';
import { AppText, Notice } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatCredits } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

const TYPE_LABELS: Record<CreditTransactionType, string> = {
  QUOTE: 'Teklif',
  QUOTE_REFUND: 'Teklif iadesi',
  ADMIN_CREDIT: 'Yönetim ekledi',
  ADMIN_DEBIT: 'Yönetim düştü',
  WELCOME: 'Hoş geldin kredisi',
  TRANSFER_TOPUP: 'Havale/EFT',
  CARD_TOPUP: 'Kartla ödeme',
};

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('tr-TR')}`;

/**
 * Kredi bakiyesi, teklif ücretleri ve hareketler. Kredi yükleme uygulamada yok: mağazaların dijital
 * ürün kuralları nedeniyle uygulama içinde satış ya da satış sayfasına yönlendirme yapılmaz.
 */
export default function CreditsScreen() {
  const { data: summary, error, reload } = useApi<CompanyCreditSummary>('/company/credits');
  const { data: history, reload: reloadHistory } = useApi<Paginated<CreditTransaction>>('/company/credits/transactions?limit=50');
  const low = summary ? summary.enabled && summary.balance < summary.lowBalanceThreshold : false;

  return (
    <DetailScreen backLabel="Hesap" onRefresh={() => Promise.all([reload(), reloadHistory()])}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
        Kredi
      </AppText>
      {error ? <Notice>{error}</Notice> : null}
      {summary ? (
        <>
          {!summary.enabled ? <Notice tone="info">Teklif vermek şu an ücretsiz.</Notice> : null}
          <View
            style={{
              borderRadius: 16,
              padding: 16,
              backgroundColor: colors.white,
              borderWidth: low ? 2 : 1,
              borderColor: low ? colors.amber300 : colors.zinc200,
            }}
          >
            <AppText style={{ color: colors.zinc600 }}>Bakiye</AppText>
            <AppText weight="bold" style={{ fontSize: 30, lineHeight: 36 }}>
              {formatCredits(summary.balance)}
            </AppText>
            {low ? <AppText weight="medium" style={{ color: colors.amber900 }}>Bakiyen azaldı.</AppText> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Cost label="Şehir içi teklif" value={summary.quoteCostLocal} />
            <Cost label="Şehirler arası teklif" value={summary.quoteCostIntercity} />
          </View>
          <AppText style={{ color: colors.zinc600, fontSize: 14 }}>Teklifi güncellemek ücretsizdir.</AppText>
        </>
      ) : null}

      {history ? (
        <Section title="Hareketler">
          {history.items.length === 0 ? (
            <EmptyState title="Hareket yok" text="Teklif verdiğinde ya da bakiyen değiştiğinde burada görünür." />
          ) : (
            history.items.map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: colors.zinc100, paddingTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="medium">{TYPE_LABELS[t.type]}</AppText>
                  <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>
                    {formatDate(t.createdAt)}
                    {t.request ? ` · ${t.request.fromCityName ?? '?'} → ${t.request.toCityName ?? '?'}` : ''}
                  </AppText>
                  {t.note ? <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>{t.note}</AppText> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText weight="semibold" style={{ color: t.amount < 0 ? colors.zinc900 : colors.green700 }}>
                    {signed(t.amount)}
                  </AppText>
                  <AppText style={{ color: colors.zinc500, fontSize: 13 }}>{t.balanceAfter.toLocaleString('tr-TR')}</AppText>
                </View>
              </View>
            ))
          )}
        </Section>
      ) : null}
    </DetailScreen>
  );
}

function Cost({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.zinc200 }}>
      <AppText style={{ color: colors.zinc600, fontSize: 13 }}>{label}</AppText>
      <AppText weight="bold" style={{ fontSize: 18 }}>
        {formatCredits(value)}
      </AppText>
    </View>
  );
}
