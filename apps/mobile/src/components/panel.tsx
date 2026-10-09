import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
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
