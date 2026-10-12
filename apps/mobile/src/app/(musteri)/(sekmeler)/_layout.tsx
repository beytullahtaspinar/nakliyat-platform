import Ionicons from '@expo/vector-icons/Ionicons';
import type { UnreadMessages } from '@nakliyat/api-client';
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

/** Müşteri menüsü. Taleplerim rozeti: firmalardan gelen okunmamış mesajlar */
export default function TabsLayout() {
  const { data: unread, reload } = useApi<UnreadMessages>('/messages/unread');
  const unreadTotal = unread?.total ?? 0;

  return (
    <Tabs
      screenListeners={{ tabPress: () => void reload() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.zinc500,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.zinc200 },
        tabBarBadgeStyle: { backgroundColor: colors.accent500, color: colors.white, fontFamily: fonts.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.zinc50 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Taleplerim',
          tabBarIcon: icon('file-tray-full', 'file-tray-full-outline'),
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarAccessibilityLabel: unreadTotal > 0 ? `Taleplerim, ${unreadTotal} okunmamış mesaj` : 'Taleplerim',
        }}
      />
      <Tabs.Screen name="teklif-al" options={{ title: 'Teklif al', tabBarIcon: icon('add-circle', 'add-circle-outline') }} />
      <Tabs.Screen name="hesabim" options={{ title: 'Hesabım', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
