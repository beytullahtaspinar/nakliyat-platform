import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { pushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { colors } from '@/theme';

/** Bildirim izni yoksa panoda gösterilir: yeni talep ve mesajlar telefona düşsün */
export function PushPrompt({ text }: { text: string }) {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  // Kullanıcı telefon ayarlarından açıp dönerse kart kaybolsun
  useFocusEffect(
    useCallback(() => {
      void pushPermission()
        .then(setPermission)
        .catch(() => setPermission('granted'));
    }, []),
  );

  if (!permission || permission === 'granted') return null;

  async function enable() {
    if (permission === 'denied') return void Linking.openSettings();
    setBusy(true);
    try {
      setPermission(await registerForPush({ ask: true }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.accent500,
        backgroundColor: colors.accent50,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Ionicons name="notifications" size={24} color={colors.accent700} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight="semibold" style={{ color: colors.accent900 }}>
            Bildirimleri aç
          </AppText>
          <AppText style={{ color: colors.accent900, fontSize: 14, lineHeight: 20 }}>
            {permission === 'denied' ? `${text} Bildirim izni kapalı; telefon ayarlarından açabilirsin.` : text}
          </AppText>
        </View>
      </View>
      <Button title={permission === 'denied' ? 'Telefon ayarlarını aç' : 'Bildirimleri aç'} loading={busy} onPress={() => void enable()} />
    </View>
  );
}
