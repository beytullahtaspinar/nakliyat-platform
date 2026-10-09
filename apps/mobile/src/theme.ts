/** Web'deki görsel kimlikle aynı renkler (apps/web/src/app/globals.css). */
export const colors = {
  brand50: '#eff4ff',
  brand100: '#dbe6fe',
  brand600: '#1d4ed8',
  brand700: '#1e3a8a',
  brand900: '#172554',
  accent50: '#fff7ed',
  accent500: '#f97316',
  accent700: '#c2410c',
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
  accent100: '#ffedd5',
  accent900: '#7c2d12',
} as const;

/** Inter, kök düzende yüklenir (src/app/_layout.tsx) */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;
