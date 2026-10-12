import Ionicons from '@expo/vector-icons/Ionicons';
import type { NotificationPreferences } from '@nakliyat/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { pushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

type Channel = 'EMAIL' | 'PUSH';
const CHANNEL_LABEL: Record<Channel, string> = { PUSH: 'Telefona bildirim', EMAIL: 'E-posta' };

/** Sitedeki /hesabim/bildirimler ve /firma-paneli/bildirimler: bu telefonun izni ve tür tür kanal tercihleri */
export function NotificationSettingsScreen({ backLabel }: { backLabel: string }) {
  const { data, error, reload } = useApi<NotificationPreferences>('/notifications/preferences');
  const [saved, setSaved] = useState<NotificationPreferences | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const prefs = saved ?? data;

  // Ekrana her dönüşte sunucudaki son durum gösterilir
  useFocusEffect(
    useCallback(() => {
      setSaved(null);
    }, []),
  );

  async function toggle(type: string, channel: Channel, enabled: boolean) {
    if (!prefs) return;
    setSaveError(null);
    // Önce ekranda değişir; kaydedilemezse eski haline döner
    const previous = prefs;
    setSaved({
      ...prefs,
      items: prefs.items.map((i) => (i.type === type ? { ...i, channels: { ...i.channels, [channel]: enabled } } : i)),
    });
    try {
      setSaved(
        await api.request<NotificationPreferences>('/notifications/preferences', {
          method: 'PATCH',
          body: { items: [{ type, channel, enabled }] },
        }),
      );
    } catch (e) {
      setSaved(previous);
      setSaveError(e instanceof Error ? e.message : 'Tercih kaydedilemedi, tekrar dene.');
    }
  }

  const channels = (prefs?.channels ?? []).slice().sort((a) => (a === 'PUSH' ? -1 : 1));

  return (
    <DetailScreen backLabel={backLabel} onRefresh={() => reload().then(() => setSaved(null))}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
        Bildirim tercihleri
      </AppText>

      <PhoneSection onRegistered={() => void reload().then(() => setSaved(null))} />

      {error ? <Notice>{error}</Notice> : null}
      {saveError ? <Notice>{saveError}</Notice> : null}
      {prefs ? (
        <Section
          title="Hangi durumda haber verelim?"
          description={prefs.email ? `E-postalar ${prefs.email} adresine gider.` : 'Hesabında e-posta adresi yok; yalnızca telefona bildirim gelir.'}
        >
          {prefs.items.map((item, i) => (
            <View key={item.type} style={{ gap: 8, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.zinc100 }}>
              <View style={{ gap: 2 }}>
                <AppText weight="semibold">{item.label}</AppText>
                <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>{item.description}</AppText>
              </View>
              {channels.map((channel) => (
                <View key={channel} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
                  <AppText style={{ flex: 1, color: colors.zinc900 }}>{CHANNEL_LABEL[channel]}</AppText>
                  <Switch
                    accessibilityLabel={`${item.label}: ${CHANNEL_LABEL[channel]}`}
                    value={item.channels[channel] ?? true}
                    disabled={channel === 'EMAIL' && !prefs.email}
                    onValueChange={(v) => void toggle(item.type, channel, v)}
                    trackColor={{ true: colors.brand700, false: colors.zinc300 }}
                    thumbColor={colors.white}
                    ios_backgroundColor={colors.zinc300}
                  />
                </View>
              ))}
            </View>
          ))}
        </Section>
      ) : !error ? (
        <AppText style={{ color: colors.zinc600 }}>Yükleniyor…</AppText>
      ) : null}
    </DetailScreen>
  );
}

/** Bu telefonun bildirim izni; açıksa deneme bildirimi gönderilebilir */
function PhoneSection({ onRegistered }: { onRegistered: () => void }) {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  // Kullanıcı telefon ayarlarından açıp dönerse durum yenilensin
  useFocusEffect(
    useCallback(() => {
      void pushPermission()
        .then(setPermission)
        .catch(() => setPermission('undetermined'));
    }, []),
  );

  async function enable() {
    if (permission === 'denied') return void Linking.openSettings();
    setBusy(true);
    try {
      const next = await registerForPush({ ask: true });
      setPermission(next);
      if (next === 'granted') onRegistered();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const { sent } = await api.request<{ sent: boolean }>('/notifications/push/test', { method: 'POST' });
      setMessage(
        sent
          ? { tone: 'info', text: 'Deneme bildirimi gönderildi. Birkaç saniye içinde telefonuna gelmeli.' }
          : { tone: 'error', text: 'Bildirim gönderilemedi. Uygulamayı kapatıp açtıktan sonra tekrar dene.' },
      );
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Bildirim gönderilemedi.' });
    } finally {
      setBusy(false);
    }
  }

  if (!permission) return null;
  const on = permission === 'granted';
  return (
    <Section title="Bu telefon">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={on ? 'notifications' : 'notifications-off-outline'} size={24} color={on ? colors.green700 : colors.zinc500} />
        <AppText style={{ flex: 1 }}>
          {on
            ? 'Bildirimler bu telefonda açık.'
            : permission === 'denied'
              ? 'Bildirim izni kapalı. Telefon ayarlarından açabilirsin.'
              : 'Bildirimler kapalı. Açarsan yeni teklif ve mesajları anında görürsün.'}
        </AppText>
      </View>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {on ? (
        <Button title="Deneme bildirimi gönder" icon="paper-plane-outline" kind="secondary" loading={busy} onPress={() => void test()} />
      ) : (
        <Button title={permission === 'denied' ? 'Telefon ayarlarını aç' : 'Bildirimleri aç'} loading={busy} onPress={() => void enable()} />
      )}
    </Section>
  );
}
