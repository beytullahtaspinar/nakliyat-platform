import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialSignIn } from '@/components/social-sign-in';
import { AppText, Button, Field, Notice, PasswordField, Wordmark } from '@/components/ui';
import { useSession } from '@/lib/session';
import { variant, WEB_ORIGIN } from '@/lib/variant';
import { colors } from '@/theme';

const COPY = {
  firma: {
    title: 'Firma girişi',
    lead: 'Gelen talepleri gör, teklif ver, işlerini takip et.',
    signupLabel: 'Firmanı kaydet',
  },
  musteri: {
    title: 'Giriş yap',
    lead: 'Taşınma talebini oluştur, firmalardan gelen teklifleri karşılaştır.',
    signupLabel: 'Hesap oluştur',
  },
} as const;

export default function LoginScreen() {
  const { signIn } = useSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const copy = COPY[variant];
  const insets = useSafeAreaInsets();

  async function submit() {
    if (!login.trim() || !password) {
      setError('Telefon numaranı ya da e-postanı ve şifreni yaz.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(login.trim(), password);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Giriş yapılamadı, tekrar dene.';
      setError(message.includes('Google veya Apple') ? 'Bu hesap Google veya Apple ile açıldı. Aşağıdaki düğmeyle devam et.' : message);
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      {/* Lacivert üst alan; yazılar açık renkte kalsın */}
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: colors.brand700,
              paddingTop: insets.top + 28,
              paddingHorizontal: 24,
              paddingBottom: 64,
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
              gap: 28,
            }}
          >
            <Wordmark onDark center />
            <View style={{ gap: 8, alignItems: 'center' }}>
              <AppText weight="bold" accessibilityRole="header" style={{ color: colors.white, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, textAlign: 'center' }}>
                {copy.title}
              </AppText>
              <AppText style={{ color: colors.brand100, fontSize: 16, lineHeight: 23, textAlign: 'center' }}>{copy.lead}</AppText>
            </View>
          </View>

          <View
            style={{
              marginTop: -40,
              marginHorizontal: 16,
              padding: 20,
              gap: 16,
              backgroundColor: colors.white,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.zinc200,
              shadowColor: colors.brand900,
              shadowOpacity: 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            }}
          >
            <Field
              label="Cep telefonu veya e-posta"
              placeholder="05xx xxx xx xx ya da ad@ornek.com"
              value={login}
              onChangeText={setLogin}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
            <PasswordField
              ref={passwordRef}
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button title="Giriş yap" loading={loading} onPress={() => void submit()} />
            <TextLink label="Şifremi unuttum" path="/sifre-sifirla" />
            <SocialSignIn onError={setError} />
          </View>

          <View style={{ marginTop: 'auto', paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
            <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>Hesabın yok mu?</AppText>
            <Button title={copy.signupLabel} kind="secondary" onPress={() => router.push('/kayit')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Şifre sıfırlama sitede yapılır */
function TextLink({ label, path }: { label: string; path: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => void Linking.openURL(`${WEB_ORIGIN}${path}`)}
      style={{ alignSelf: 'center', paddingVertical: 6 }}
    >
      <AppText weight="semibold" style={{ color: colors.brand700 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
