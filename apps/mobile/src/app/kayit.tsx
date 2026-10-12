import { useRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import { DetailScreen } from '@/components/panel';
import { AppText, Button, Checkbox, Field, Notice } from '@/components/ui';
import { LEGAL_PAGES, LEGAL_VERSION, openWebPage } from '@/lib/legal';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

/** Müşteri kaydı (sitedeki /kayit). Firma kaydı belge gerektirdiği için sitede kalır. */
export default function RegisterScreen() {
  const { signUp } = useSession();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (fullName.trim().length < 3) return setError('Adını ve soyadını yaz.');
    if (!phone.trim()) return setError('Cep telefonu numaranı yaz.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Geçerli bir e-posta adresi yaz.');
    if (password.length < 8) return setError('Şifre en az 8 karakter olmalı.');
    if (!terms) return setError('Devam etmek için kullanım koşullarını kabul et.');
    setError(null);
    setLoading(true);
    try {
      // Kayıttan sonra oturum açılır; e-posta doğrulama ilk talepte istenir
      await signUp({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        termsVersion: LEGAL_VERSION,
        marketingConsent: marketing,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt tamamlanamadı, tekrar dene.');
      setLoading(false);
    }
  }

  return (
    <DetailScreen backLabel="Giriş">
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>
          Hesap oluştur
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>Taşınma talebini oluştur, onaylı firmalardan ücretsiz teklif al.</AppText>
      </View>
      <Field
        label="Ad soyad"
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        textContentType="name"
        maxLength={100}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
      />
      <Field
        ref={phoneRef}
        label="Cep telefonu"
        placeholder="05xx xxx xx xx"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <Field
        ref={emailRef}
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={191}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <Field
        ref={passwordRef}
        label="Şifre (en az 8 karakter)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={72}
      />
      <View style={{ gap: 4 }}>
        <Checkbox label="Kullanım koşullarını kabul ediyorum, KVKK aydınlatma metnini okudum." checked={terms} onChange={setTerms} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingLeft: 36 }}>
          <DocLink label="Kullanım koşulları" path={LEGAL_PAGES.terms} />
          <DocLink label="Aydınlatma metni" path={LEGAL_PAGES.kvkk} />
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Checkbox label="Kampanya ve duyurulardan haberdar olmak istiyorum (isteğe bağlı)." checked={marketing} onChange={setMarketing} />
        <View style={{ paddingLeft: 36 }}>
          <DocLink label="Açık rıza metni" path={LEGAL_PAGES.consent} />
        </View>
      </View>
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Hesap oluştur" loading={loading} onPress={() => void submit()} />
    </DetailScreen>
  );
}

function DocLink({ label, path }: { label: string; path: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={6} onPress={() => openWebPage(path)}>
      <AppText weight="semibold" style={{ color: colors.brand700, fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
