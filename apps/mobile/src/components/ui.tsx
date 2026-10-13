import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
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
import type { Tone } from '@/lib/requests';
import { variant } from '@/lib/variant';
import { colors, fonts, radius } from '@/theme';

type Weight = keyof typeof fonts;

export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: Weight }) {
  return <Text {...props} style={[styles.text, { fontFamily: fonts[weight] }, style]} />;
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

const BUTTON_FG: Record<ButtonKind, string> = { primary: colors.white, secondary: colors.brand700, danger: colors.white };

export function Button({
  title,
  loading,
  kind = 'primary',
  icon,
  disabled,
  ...props
}: Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
  kind?: ButtonKind;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const fg = BUTTON_FG[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' ? styles.buttonPrimary : kind === 'danger' ? styles.buttonDanger : styles.buttonSecondary,
        (pressed || loading) && { opacity: 0.85 },
        disabled && !loading && { opacity: 0.5 },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' }}>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          {/* Dar düğmede iki satıra bölünmesin; sığmazsa yazı biraz küçülür */}
          <AppText weight="semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: fg, fontSize: 16, flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
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

/** Şifre alanı: sağdaki göz düğmesiyle yazılan şifre gösterilir/gizlenir */
export const PasswordField = forwardRef<TextInput, Omit<TextInputProps, 'secureTextEntry'> & { label: string }>(function PasswordField(
  { label, style, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <AppText weight="medium" style={{ color: colors.zinc900 }}>
        {label}
      </AppText>
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.zinc500}
          accessibilityLabel={label}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { paddingRight: 52 }, style]}
          {...props}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          onPress={() => setVisible((v) => !v)}
          hitSlop={6}
          style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.zinc600} />
        </Pressable>
      </View>
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

const BADGE_TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  warning: { bg: colors.amber50, fg: colors.amber900, border: colors.amber300 },
  accent: { bg: colors.accent50, fg: colors.accent900, border: colors.accent100 },
  brand: { bg: colors.brand50, fg: colors.brand700, border: colors.brand100 },
  neutral: { bg: colors.zinc100, fg: colors.zinc600, border: colors.zinc200 },
  success: { bg: colors.green50, fg: colors.green700, border: colors.green50 },
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Durum ya da bilgi rozeti; simgeyle verilirse simge rozetin renginde gösterilir */
export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  const t = BADGE_TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, icon ? styles.badgeWithIcon : null]}>
      {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
      <AppText weight="semibold" style={{ color: t.fg, fontSize: 13, lineHeight: 18 }}>
        {tone === 'warning' && !icon ? '! ' : ''}
        {children}
      </AppText>
    </View>
  );
}

/** Rozetleri yan yana dizer, sığmayan alt satıra iner */
export function Badges({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

/** Liste süzgeci: yatay kayan seçenekler, seçili olan dolu */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.brand700, borderColor: colors.brand700 }]}
          >
            <AppText weight="semibold" style={{ fontSize: 14, color: selected ? colors.white : colors.zinc600 }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
    >
      <View style={[styles.checkbox, checked && { backgroundColor: colors.brand700, borderColor: colors.brand700 }]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <AppText style={{ flex: 1 }}>
        {label}
        {hint ? <AppText weight="semibold" style={{ color: colors.accent700 }}>{` ${hint}`}</AppText> : null}
      </AppText>
    </Pressable>
  );
}

const MARKS = {
  firma: require('../../assets/firma/icon.png'),
  musteri: require('../../assets/musteri/icon.png'),
} as const;

/** Marka işareti: hız çizgili "e"; müşteri uygulamasında lacivert, firma uygulamasında turuncu zemin */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={MARKS[variant]}
      style={{ width: size, height: size, borderRadius: size * 0.25 }}
      accessibilityIgnoresInvertColors
    />
  );
}

const LOGO = require('../../assets/logo.png');
const LOGO_ON_DARK = require('../../assets/logo-beyaz.png');
const LOGO_RATIO = 1200 / 161;

/**
 * Giriş ekranındaki tam logo (sitedekiyle aynı). `onDark` lacivert zeminde beyaz yazılı logoyu kullanır;
 * firma uygulamasında altında turuncu "Firma uygulaması" etiketi durur.
 */
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const height = 30;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={variant === 'firma' ? 'Evden Eve Nakliyat Firma' : 'Evden Eve Nakliyat'}
      style={{ gap: 12, alignItems: 'flex-start' }}
    >
      <Image source={onDark ? LOGO_ON_DARK : LOGO} style={{ width: height * LOGO_RATIO, height }} resizeMode="contain" />
      {variant === 'firma' ? (
        <View style={{ backgroundColor: colors.accent500, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <AppText weight="bold" style={{ color: colors.brand900, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 }}>
            FİRMA UYGULAMASI
          </AppText>
        </View>
      ) : null}
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
  buttonDanger: { backgroundColor: colors.red700 },
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
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8, paddingVertical: 3 },
  segment: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.zinc300,
    backgroundColor: colors.white,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.zinc300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
