// Yalnızca kullanılan dört ağırlık: paketin kökünden almak 18 dosyanın hepsini uygulamaya ekler
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { variant } from '@/lib/variant';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir; uygulama açılışta takılmaz.
  const ready = fontsLoaded || fontError !== null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>{ready ? <RootStack /> : null}</SessionProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { state } = useSession();

  useEffect(() => {
    if (state.status !== 'loading') void SplashScreen.hideAsync();
  }, [state.status]);

  if (state.status === 'loading') return null;
  if (state.status === 'offline') return <OfflineScreen message={state.message} />;

  const signedIn = state.status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.zinc50 } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="giris" />
      </Stack.Protected>
      {/* Her uygulama yalnızca kendi rolünün ekranlarını içerir; giriş ekranı rolü zaten doğrular. */}
      <Stack.Protected guard={signedIn && variant === 'firma'}>
        <Stack.Screen name="(firma)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && variant === 'musteri'}>
        <Stack.Screen name="(musteri)" />
      </Stack.Protected>
    </Stack>
  );
}

function OfflineScreen({ message }: { message: string }) {
  const { reload } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <AppText weight="bold" style={{ fontSize: 22 }}>
          Bağlantı kurulamadı
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>{message}</AppText>
        <Button
          title="Tekrar dene"
          loading={busy}
          onPress={() => {
            setBusy(true);
            void reload().finally(() => setBusy(false));
          }}
        />
      </View>
    </SafeAreaView>
  );
}
