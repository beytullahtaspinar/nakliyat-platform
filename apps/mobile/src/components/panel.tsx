import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, LogoMark } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/** Oturum açık ekranların ortak kabuğu: üstte işaret + ad + çıkış, altta yenilenebilir içerik. */
export function PanelScreen({
  title,
  onRefresh,
  children,
}: {
  title: string;
  onRefresh?: () => Promise<unknown>;
  children: ReactNode;
}) {
  const user = useUser();
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
      <ScrollView
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
      </ScrollView>
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
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.zinc200, backgroundColor: colors.white }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Geri: ${backLabel}`}
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, minHeight: 52, alignSelf: 'flex-start' }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand700} />
          <AppText weight="semibold" style={{ color: colors.brand700 }}>
            {backLabel}
          </AppText>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
