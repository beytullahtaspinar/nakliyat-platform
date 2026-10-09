import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { variant } from '@/lib/variant';
import { colors, fonts, radius } from '@/theme';

type Weight = keyof typeof fonts;

export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: Weight }) {
  return <Text {...props} style={[styles.text, { fontFamily: fonts[weight] }, style]} />;
}

export function Button({
  title,
  loading,
  kind = 'primary',
  disabled,
  ...props
}: Omit<PressableProps, 'children'> & { title: string; loading?: boolean; kind?: 'primary' | 'secondary' }) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || loading) && { opacity: 0.85 },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.white : colors.brand700} />
      ) : (
        <AppText weight="semibold" style={{ color: primary ? colors.white : colors.brand700, fontSize: 16 }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string }>(function Field({ label, style, ...props }, ref) {
  return (
    <View style={{ gap: 6 }}>
      <AppText weight="medium" style={{ color: colors.zinc900 }}>
        {label}
      </AppText>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.zinc500}
        accessibilityLabel={label}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
});

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  const error = tone === 'error';
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: error ? colors.red50 : colors.brand50 }]}
    >
      <AppText style={{ color: error ? colors.red700 : colors.brand700 }}>{children}</AppText>
    </View>
  );
}

const MARKS = {
  firma: require('../../assets/firma/icon.png'),
  musteri: require('../../assets/musteri/icon.png'),
} as const;

/** Marka işareti: kalın "e" ve nokta; firma uygulamasında turuncu zemin */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={MARKS[variant]}
      style={{ width: size, height: size, borderRadius: size * 0.25 }}
      accessibilityIgnoresInvertColors
    />
  );
}

export function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={36} />
      <AppText weight="bold" style={{ fontSize: 17, color: colors.zinc900, letterSpacing: -0.3 }}>
        evdenevenakliyat<AppText weight="bold" style={{ color: colors.accent700 }}>.app</AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.zinc900, fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonPrimary: { backgroundColor: colors.brand700 },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.zinc300 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.zinc300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.zinc900,
    backgroundColor: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.zinc200,
    padding: 16,
  },
  notice: { borderRadius: radius.md, padding: 12 },
});
