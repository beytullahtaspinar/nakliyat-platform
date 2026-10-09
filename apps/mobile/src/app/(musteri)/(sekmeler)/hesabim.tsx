import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { PanelScreen, Section } from '@/components/panel';
import { AppText, Badge, Button } from '@/components/ui';
import { formatPhone } from '@/lib/bookings';
import { LEGAL_PAGES, openWebPage } from '@/lib/legal';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/** Müşteri hesabı: iletişim bilgileri, doğrulama, yasal metinler, çıkış ve hesap silme */
export default function AccountScreen() {
  const user = useUser();
  const { signOut, reload } = useSession();

  function confirmSignOut() {
    Alert.alert('Çıkış yap', 'Bu cihazdaki oturumun kapanacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <PanelScreen title="Hesabım" onRefresh={reload}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" style={{ fontSize: 18 }}>
          {user.fullName}
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          {[formatPhone(user.phone), user.email].filter(Boolean).join(' · ')}
        </AppText>
        <Badge tone={user.verified ? 'success' : 'warning'}>{user.verified ? 'Hesabın doğrulandı' : 'Doğrulama bekliyor'}</Badge>
      </View>

      <Section title="Hesap">
        {!user.verified ? <Row icon="shield-checkmark-outline" label="Hesabını doğrula" hint="Taleplerinin firmalara iletilmesi için gerekli" to="/dogrulama" /> : null}
        <Row icon="notifications-outline" label="Bildirim tercihleri" external onPress={() => openWebPage('/hesabim/bildirimler')} />
        <Row icon="key-outline" label="Şifremi değiştir" external onPress={() => openWebPage('/sifre-sifirla')} />
      </Section>

      <Section title="Yasal metinler">
        <Row icon="document-text-outline" label="Kullanım koşulları" external onPress={() => openWebPage(LEGAL_PAGES.terms)} />
        <Row icon="lock-closed-outline" label="Gizlilik politikası" external onPress={() => openWebPage(LEGAL_PAGES.privacy)} />
        <Row icon="information-circle-outline" label="KVKK aydınlatma metni" external onPress={() => openWebPage(LEGAL_PAGES.kvkk)} />
      </Section>

      <Button title="Çıkış yap" kind="secondary" onPress={confirmSignOut} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/hesabimi-sil')} hitSlop={8} style={{ alignSelf: 'center', padding: 8 }}>
        <AppText weight="semibold" style={{ color: colors.red700 }}>
          Hesabımı sil
        </AppText>
      </Pressable>
    </PanelScreen>
  );
}

function Row({
  icon,
  label,
  hint,
  to,
  external,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  to?: Href;
  external?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityHint={hint}
      onPress={onPress ?? (() => to && router.push(to))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={22} color={colors.brand700} />
      <View style={{ flex: 1 }}>
        <AppText weight="medium">{label}</AppText>
        {hint ? <AppText style={{ color: colors.accent700, fontSize: 13, lineHeight: 18 }}>{hint}</AppText> : null}
      </View>
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={18} color={colors.zinc500} />
    </Pressable>
  );
}
