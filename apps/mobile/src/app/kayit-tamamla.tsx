import type { AuthResponse } from '@nakliyat/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen } from '@/components/panel';
import { AppText, Button, Checkbox, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { LEGAL_PAGES, LEGAL_VERSION, openWebPage } from '@/lib/legal';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

/** Google / Apple ile ilk giriş: telefon numarası ve onaylar alınıp müşteri hesabı açılır (sitedeki /kayit/tamamla) */
export default function CompleteSignupScreen() {
  const { belirtec, ad, eposta } = useLocalSearchParams<{ belirtec: string; ad?: string; eposta?: string }>();
  const { adopt } = useSession();
  const [fullName, setFullName] = useState(ad ?? '');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (fullName.trim().length < 3) return setError('Adını ve soyadını yaz.');
    if (!phone.trim()) return setError('Cep telefonu numaranı yaz.');
    if (!terms) return setError('Devam etmek için kullanım koşullarını kabul et.');
    setError(null);
    setLoading(true);
    try {
      const response = await api.request<AuthResponse>('/auth/oauth/complete', {
        method: 'POST',
        auth: false,
        body: {
          signupToken: belirtec,
          role: 'CUSTOMER',
          fullName: fullName.trim(),
          phone: phone.trim(),
          termsVersion: LEGAL_VERSION,
          marketingConsent: marketing,
        },
      });
      await adopt(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt tamamlanamadı, tekrar dene.');
      setLoading(false);
    }
  }

  return (
    <DetailScreen backLabel="Giriş">
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>
          Kaydını tamamla
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          {eposta ? `${eposta} ile devam ediyorsun. ` : ''}Firmalar teklif kabul ettiğinde seni arayabilsin diye cep telefonu numaranı ekle.
        </AppText>
      </View>
      <Field label="Ad soyad" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" maxLength={100} />
      <Field
        label="Cep telefonu"
        placeholder="05xx xxx xx xx"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
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
      <Button title="Hesabımı oluştur" loading={loading} onPress={() => void submit()} />
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
