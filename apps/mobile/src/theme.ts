/** Web'deki görsel kimlikle aynı renkler (apps/web/src/app/globals.css). */
export const colors = {
  brand50: '#eef2fb',
  brand100: '#dce4f6',
  brand600: '#2e4a9c',
  brand700: '#1b2f6e',
  brand900: '#111e48',
  accent50: '#fff6ea',
  accent500: '#ff8a00',
  accent700: '#a34c00',
  zinc50: '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc900: '#18181b',
  white: '#ffffff',
  red50: '#fef2f2',
  red700: '#b91c1c',
  green50: '#f0fdf4',
  green700: '#15803d',
  amber50: '#fffbeb',
  amber300: '#fcd34d',
  amber500: '#f59e0b',
  amber900: '#78350f',
  accent100: '#ffead0',
  accent900: '#6a3300',
} as const;

/** Inter, kök düzende yüklenir (src/app/_layout.tsx) */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;
