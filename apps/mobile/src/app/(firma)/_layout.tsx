import { ApiError } from '@nakliyat/api-client';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { CompanySetupScreen } from '@/components/company-setup';
import { api } from '@/lib/api';
import { companyRoute, useNotificationRouting } from '@/lib/notification-routes';
import { registerForPush } from '@/lib/push';
import { colors } from '@/theme';

/** Firma uygulaması: alt sekmeler ve sekmelerin üstüne açılan ayrıntı ekranları */
export default function Layout() {
  useNotificationRouting(companyRoute);
  // Google / Apple ile uygulamadan açılan hesabın henüz firma profili yok: önce firma bilgileri istenir
  const [profile, setProfile] = useState<'checking' | 'missing' | 'ready'>('checking');
  // İzin daha önce verildiyse telefon her açılışta yeniden kaydedilir (adres değişmiş olabilir)
  useEffect(() => {
    void registerForPush({ ask: false });
    api
      .request('/company/profile')
      // Yalnızca "profil yok" bu ekranı açar; bağlantı hatasında panel kendi hata mesajını gösterir
      .then(() => setProfile('ready'))
      .catch((e) => setProfile(e instanceof ApiError && e.status === 404 ? 'missing' : 'ready'));
  }, []);

  if (profile === 'checking') return null;
  if (profile === 'missing') return <CompanySetupScreen onCreated={() => setProfile('ready')} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.zinc50 } }}>
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="talep/[id]" />
      <Stack.Screen name="is/[id]/index" />
      <Stack.Screen name="is/[id]/mesajlar" />
      <Stack.Screen name="takvim" />
      <Stack.Screen name="degerlendirmeler" />
      <Stack.Screen name="belgeler" />
      <Stack.Screen name="araclar" />
      <Stack.Screen name="kredi" />
      <Stack.Screen name="musteriler" />
      <Stack.Screen name="hesap-sil" />
      <Stack.Screen name="bildirimler" />
      <Stack.Screen name="sifre" />
    </Stack>
  );
}
