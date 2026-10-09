import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

/** Bu telefonun sunucuya kaydedilen bildirim adresi; çıkışta silmek için saklanır */
const TOKEN_KEY = 'nk_bildirim_adresi';

// Uygulama açıkken gelen bildirim de üstte görünsün
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function pushPermission(): Promise<PushPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  // Kullanıcı "bir daha sorma" dediyse yalnızca telefon ayarlarından açılabilir
  return status === 'denied' && !canAskAgain ? 'denied' : 'undetermined';
}

/**
 * Bildirim izni varsa (ask: true ise önce izin ister) telefonu sunucuya kaydeder.
 * Firebase/APNs ayarı eksikse ya da ağ yoksa uygulama çökmez; sessizce vazgeçilir, sonraki açılışta yeniden denenir.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  // Android 8+: bildirimin önemi kanalla belirlenir. Kanal izin isteğinden önce açılmalı.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Talepler ve mesajlar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let permission = await pushPermission();
  if (permission === 'undetermined' && ask) {
    const { status } = await Notifications.requestPermissionsAsync();
    permission = status === 'granted' ? 'granted' : await pushPermission();
  }
  if (permission !== 'granted') return permission;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api.request('/notifications/push/devices', { method: 'POST', body: { token, platform: Platform.OS } });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Bildirim kaydı yapılamadı', e);
  }
  return permission;
}

/** Çıkıştan önce: bu telefona artık bu hesabın bildirimi gitmesin. Hata çıkışı engellemez. */
export async function unregisterPush() {
  if (Platform.OS === 'web') return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await api.request('/notifications/push/devices', { method: 'DELETE', body: { token } }).catch(() => undefined);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Hesap silindiğinde: sunucudaki kayıt zaten silindi, yalnızca bu telefondaki adres unutulur */
export async function forgetPushToken() {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
