import Ionicons from '@expo/vector-icons/Ionicons';
import type { CompanyOverview, UnreadMessages } from '@nakliyat/api-client';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useApi } from '@/lib/use-api';
import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon =
  (active: IconName, inactive: IconName) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? active : inactive} color={color} size={size} />
  );

/** Sitedeki firma panelinin menüsü. Rozetler: teklif vermediğin talepler ve okunmamış mesajlar */
export default function TabsLayout() {
  const { data, reload } = useApi<CompanyOverview>('/company/overview');
  const { data: unread, reload: reloadUnread } = useApi<UnreadMessages>('/messages/unread');
  const notQuoted = data?.requests.notQuoted ?? 0;
  const unreadTotal = unread?.total ?? 0;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          void reload();
          void reloadUnread();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.zinc500,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.zinc200 },
        tabBarBadgeStyle: { backgroundColor: colors.accent500, color: colors.white, fontFamily: fonts.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.zinc50 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Pano', tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Screen
        name="talepler"
        options={{
          title: 'Talepler',
          tabBarIcon: icon('file-tray-full', 'file-tray-full-outline'),
          tabBarBadge: notQuoted > 0 ? (notQuoted > 99 ? '99+' : notQuoted) : undefined,
          tabBarAccessibilityLabel: notQuoted > 0 ? `Gelen talepler, ${notQuoted} tanesine teklif vermedin` : 'Gelen talepler',
        }}
      />
      <Tabs.Screen name="teklifler" options={{ title: 'Tekliflerim', tabBarIcon: icon('pricetag', 'pricetag-outline') }} />
      <Tabs.Screen
        name="isler"
        options={{
          title: 'İşlerim',
          tabBarIcon: icon('car', 'car-outline'),
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarAccessibilityLabel: unreadTotal > 0 ? `İşlerim, ${unreadTotal} okunmamış mesaj` : 'İşlerim',
        }}
      />
    </Tabs>
  );
}
