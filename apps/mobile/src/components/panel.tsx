import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, LogoMark } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/** Oturum açık ekranların ortak kabuğu: üstte işaret + ad + çıkış, altta yenilenebilir içerik. */
export function PanelScreen({
  title,
  onRefresh,
  form,
  children,
}: {
  title: string;
  onRefresh?: () => Promise<unknown>;
  /** Form ekranı: odaklanan alan klavyenin üstüne kayar */
  form?: boolean;
  children: ReactNode;
}) {
  const user = useUser();
  const Scroll = form ? KeyboardAwareScrollView : ScrollView;
  const { signOut } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  function confirmSignOut() {
    Alert.alert('Çıkış yap', 'Bu cihazdaki oturumun kapanacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.zinc200,
          backgroundColor: colors.white,
        }}
      >
        <LogoMark size={32} />
        <AppText weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {user.fullName}
        </AppText>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmSignOut} style={{ paddingVertical: 6 }}>
          <AppText weight="medium" style={{ color: colors.zinc600 }}>
            Çıkış
          </AppText>
        </Pressable>
      </View>
      <Scroll
        bottomOffset={form ? 24 : undefined}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.brand700}
              colors={[colors.brand700]}
              onRefresh={() => {
                setRefreshing(true);
                void onRefresh().finally(() => setRefreshing(false));
              }}
            />
          ) : undefined
        }
      >
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.4 }}>
          {title}
        </AppText>
        {children}
      </Scroll>
    </SafeAreaView>
  );
}

/** Listeden açılan ayrıntı ekranı: üstte geri düğmesi, altta yenilenebilir ve klavyeye göre kayan içerik. */
export function DetailScreen({
  backLabel,
  onRefresh,
  children,
}: {
  backLabel: string;
  onRefresh?: () => Promise<unknown>;
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      <BackHeader label={backLabel} />
      {/* Odaklanan alan klavyenin üstüne kayar (Android'de kenardan kenara düzende de) */}
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.brand700}
              colors={[colors.brand700]}
              onRefresh={() => {
                setRefreshing(true);
                void onRefresh().finally(() => setRefreshing(false));
              }}
            />
          ) : undefined
        }
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/** Ayrıntı ekranlarının üst çubuğu: geri düğmesi, isteğe bağlı başlık */
export function BackHeader({ label, title }: { label: string; title?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc200,
        backgroundColor: colors.white,
        paddingRight: 16,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Geri: ${label}`}
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, minHeight: 52 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.brand700} />
        {title ? null : (
          <AppText weight="semibold" style={{ color: colors.brand700 }}>
            {label}
          </AppText>
        )}
      </Pressable>
      {title ? (
        <AppText weight="semibold" numberOfLines={1} accessibilityRole="header" style={{ flex: 1, fontSize: 16 }}>
          {title}
        </AppText>
      ) : null}
    </View>
  );
}

/** Ekran içi bölüm: başlık, isteğe bağlı açıklama, kart içinde içerik */
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
        {title}
      </AppText>
      {description ? <AppText style={{ color: colors.zinc600, fontSize: 14, lineHeight: 20 }}>{description}</AppText> : null}
      <View
        style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.zinc200, padding: 16, gap: 12 }}
      >
        {children}
      </View>
    </View>
  );
}

/** Liste boşken gösterilen kısa açıklama */
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 6 }}>
      <AppText weight="semibold" style={{ fontSize: 16, textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>{text}</AppText>
    </View>
  );
}
