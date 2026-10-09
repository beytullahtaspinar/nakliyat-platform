import { Stack } from 'expo-router';
import { colors } from '@/theme';

/** Firma uygulaması: alt sekmeler ve sekmelerin üstüne açılan ayrıntı ekranları */
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.zinc50 } }}>
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="talep/[id]" />
    </Stack>
  );
}
