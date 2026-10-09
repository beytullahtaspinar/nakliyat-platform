import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Field, Notice, Wordmark } from '@/components/ui';
import { useSession } from '@/lib/session';
import { variant, WEB_ORIGIN } from '@/lib/variant';
import { colors } from '@/theme';

const COPY = {
  firma: {
    title: 'Firma girişi',
    lead: 'Gelen talepleri gör, teklif ver, işlerini takip et.',
    signupLabel: 'Firmanı kaydet',
    signupPath: '/kayit?rol=firma',
  },
  musteri: {
    title: 'Giriş yap',
    lead: 'Taşınma talebini oluştur, firmalardan gelen teklifleri karşılaştır.',
    signupLabel: 'Hesap oluştur',
    signupPath: '/kayit',
  },
} as const;

export default function LoginScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const copy = COPY[variant];

  async function submit() {
    if (!phone.trim() || !password) {
      setError('Telefon numaranı ve şifreni yaz.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(phone.trim(), password);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Giriş yapılamadı, tekrar dene.';
      // Uygulamada Google/Apple düğmesi yok: şifresiz hesaba şifre belirleme yolunu göster
      setError(
        message.includes('Google veya Apple')
          ? 'Bu hesap Google veya Apple ile açıldı. Uygulamaya girmek için aşağıdaki "Şifremi unuttum" ile e-postana gelen kodla bir şifre belirle.'
          : message,
      );
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
          <Wordmark />

          <View style={{ gap: 6, marginTop: 24 }}>
            <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.5 }}>
              {copy.title}
            </AppText>
            <AppText style={{ color: colors.zinc600 }}>{copy.lead}</AppText>
          </View>

          <View style={{ gap: 16 }}>
            <Field
              label="Cep telefonu"
              placeholder="05xx xxx xx xx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
            <Field
              ref={passwordRef}
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button title="Giriş yap" loading={loading} onPress={() => void submit()} />
            <TextLink label="Şifremi unuttum" path="/sifre-sifirla" />
          </View>

          <View style={{ marginTop: 'auto', gap: 4, alignItems: 'center' }}>
            <AppText style={{ color: colors.zinc600 }}>Hesabın yok mu?</AppText>
            {variant === 'musteri' ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/kayit')} style={{ alignSelf: 'center', paddingVertical: 6 }}>
                <AppText weight="semibold" style={{ color: colors.brand700 }}>
                  {copy.signupLabel}
                </AppText>
              </Pressable>
            ) : (
              <TextLink label={copy.signupLabel} path={copy.signupPath} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Şifre sıfırlama ve firma kaydı sitede yapılır */
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
