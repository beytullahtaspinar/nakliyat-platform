import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { customerRoute, useNotificationRouting } from '@/lib/notification-routes';
import { registerForPush } from '@/lib/push';
import { colors } from '@/theme';

/** Müşteri uygulaması: alt sekmeler ve sekmelerin üstüne açılan ayrıntı ekranları */
export default function Layout() {
  useNotificationRouting(customerRoute);
  // İzin daha önce verildiyse telefon her açılışta yeniden kaydedilir (adres değişmiş olabilir)
  useEffect(() => {
    void registerForPush({ ask: false });
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.zinc50 } }}>
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="taleplerim/[id]" />
      <Stack.Screen name="mesajlar/[id]" />
      <Stack.Screen name="dogrulama" />
      <Stack.Screen name="hesabimi-sil" />
    </Stack>
  );
}
