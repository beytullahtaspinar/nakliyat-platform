import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { companyRoute, useNotificationRouting } from '@/lib/notification-routes';
import { registerForPush } from '@/lib/push';
import { colors } from '@/theme';

/** Firma uygulaması: alt sekmeler ve sekmelerin üstüne açılan ayrıntı ekranları */
export default function Layout() {
  useNotificationRouting(companyRoute);
  // İzin daha önce verildiyse telefon her açılışta yeniden kaydedilir (adres değişmiş olabilir)
  useEffect(() => {
    void registerForPush({ ask: false });
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.zinc50 } }}>
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="talep/[id]" />
      <Stack.Screen name="is/[id]/index" />
      <Stack.Screen name="is/[id]/mesajlar" />
      <Stack.Screen name="takvim" />
      <Stack.Screen name="degerlendirmeler" />
      <Stack.Screen name="belgeler" />
      <Stack.Screen name="kredi" />
      <Stack.Screen name="musteriler" />
      <Stack.Screen name="hesap-sil" />
    </Stack>
  );
}
