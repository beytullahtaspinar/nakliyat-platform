import Ionicons from '@expo/vector-icons/Ionicons';
import type { CompanyCreditSummary, CompanyDocumentSummary, CompanyProfile, CompanyReviews, VerificationStatus } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { PanelScreen, Section } from '@/components/panel';
import { AppText, Badge, Button, Notice } from '@/components/ui';
import { formatCredits, type Tone } from '@/lib/requests';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { WEB_ORIGIN } from '@/lib/variant';
import { colors } from '@/theme';

const VERIFICATION: Record<VerificationStatus, { label: string; tone: Tone }> = {
  VERIFIED: { label: 'Onaylı firma', tone: 'success' },
  PENDING: { label: 'Onay bekliyor', tone: 'accent' },
  REJECTED: { label: 'Onaylanmadı', tone: 'warning' },
};

/** Firma hesabı: değerlendirmeler, belgeler, kredi, müşteriler; profil ve tanıtım sayfası sitede */
export default function AccountScreen() {
  const { signOut } = useSession();
  const { data: profile, error, reload } = useApi<CompanyProfile>('/company/profile');
  const { data: reviews, reload: reloadReviews } = useApi<CompanyReviews>('/company/reviews?limit=1');
  const { data: documents, reload: reloadDocuments } = useApi<CompanyDocumentSummary>('/company/documents');
  const { data: credits, reload: reloadCredits } = useApi<CompanyCreditSummary>('/company/credits');

  const unanswered = reviews?.summary.counts.unanswered ?? 0;
  const missing = documents?.requirements.filter((r) => r.state !== 'VERIFIED').length ?? 0;
  const status = profile ? VERIFICATION[profile.verificationStatus] : null;

  function confirmSignOut() {
    Alert.alert('Çıkış yap', 'Bu cihazdaki oturumun kapanacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <PanelScreen title="Hesap" onRefresh={() => Promise.all([reload(), reloadReviews(), reloadDocuments(), reloadCredits()])}>
      {error ? <Notice>{error}</Notice> : null}
      {profile && status ? (
        <View style={{ gap: 6 }}>
          <AppText weight="bold" style={{ fontSize: 18 }}>
            {profile.displayName}
          </AppText>
          <AppText style={{ color: colors.zinc600 }}>
            {profile.legalName}
            {profile.cityName ? ` · ${profile.cityName}` : ''}
          </AppText>
          <Badge tone={status.tone}>{status.label}</Badge>
          {profile.verificationStatus === 'REJECTED' && profile.verificationNote ? (
            <Notice>{`Gerekçe: ${profile.verificationNote}`}</Notice>
          ) : null}
        </View>
      ) : null}

      <Section title="Firma">
        <Row icon="star-outline" label="Değerlendirmeler" hint={unanswered > 0 ? `${unanswered} yanıt bekliyor` : undefined} to="/degerlendirmeler" />
        <Row icon="document-text-outline" label="Belgeler" hint={missing > 0 ? `${missing} zorunlu belge eksik ya da onaysız` : undefined} to="/belgeler" />
        <Row icon="wallet-outline" label="Kredi" value={credits ? formatCredits(credits.balance) : undefined} to="/kredi" />
        <Row icon="people-outline" label="Müşteriler" to="/musteriler" />
      </Section>

      <Section title="Sitede düzenle" description="Bu bölümler evdenevenakliyat.app firma panelinde açılır.">
        <Row icon="business-outline" label="Firma profili" external onPress={() => void Linking.openURL(`${WEB_ORIGIN}/firma-paneli/profil`)} />
        <Row icon="images-outline" label="Tanıtım sayfası" external onPress={() => void Linking.openURL(`${WEB_ORIGIN}/firma-paneli/tanitim`)} />
        <Row icon="notifications-outline" label="Bildirim tercihleri" external onPress={() => void Linking.openURL(`${WEB_ORIGIN}/firma-paneli/bildirimler`)} />
      </Section>

      <Button title="Çıkış yap" kind="secondary" onPress={confirmSignOut} />
    </PanelScreen>
  );
}

function Row({
  icon,
  label,
  hint,
  value,
  to,
  external,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  value?: string;
  to?: Href;
  external?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityHint={hint}
      onPress={onPress ?? (() => to && router.push(to))}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={colors.brand700} />
      <View style={{ flex: 1 }}>
        <AppText weight="medium">{label}</AppText>
        {hint ? <AppText style={{ color: colors.accent700, fontSize: 13, lineHeight: 18 }}>{hint}</AppText> : null}
      </View>
      {value ? <AppText style={{ color: colors.zinc600 }}>{value}</AppText> : null}
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={18} color={colors.zinc500} />
    </Pressable>
  );
}
