import type { AuthTokens } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Button, Field, Notice, PasswordField } from '@/components/ui';
import { api, storeTokens } from '@/lib/api';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

const MIN = 8;

/**
 * Şifre değiştirme. Şu anki şifreyi bilen değiştirir; bilmeyen ya da hiç şifresi olmayan (Google/Apple ile
 * açılmış) hesap e-postasına gelen kodla yeni şifre belirler.
 */
export function PasswordScreen({ backLabel }: { backLabel: string }) {
  const user = useUser();
  const [mode, setMode] = useState<'change' | 'code'>(user.hasPassword ? 'change' : 'code');
  const [done, setDone] = useState(false);

  return (
    <DetailScreen backLabel={backLabel}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
          {user.hasPassword ? 'Şifremi değiştir' : 'Şifre belirle'}
        </AppText>
        {!user.hasPassword ? (
          <AppText style={{ color: colors.zinc600 }}>
            Hesabın Google veya Apple ile açıldı. Şifre belirlersen uygulamaya telefon numaran ve bu şifreyle girebilirsin.
          </AppText>
        ) : null}
      </View>
      {done ? (
        <View style={{ gap: 12 }}>
          <Notice tone="info">Şifren değişti. Diğer cihazlardaki oturumların kapatıldı; bu telefonda oturumun açık.</Notice>
          <Button title="Hesabıma dön" onPress={() => router.back()} />
        </View>
      ) : mode === 'change' ? (
        <ChangeForm onDone={() => setDone(true)} onForgot={() => setMode('code')} />
      ) : (
        <CodeForm onDone={() => setDone(true)} />
      )}
    </DetailScreen>
  );
}

function NewPasswordFields({ value, repeat, onChange, onRepeat }: { value: string; repeat: string; onChange: (v: string) => void; onRepeat: (v: string) => void }) {
  return (
    <>
      <PasswordField
        label={`Yeni şifre (en az ${MIN} karakter)`}
        value={value}
        onChangeText={onChange}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={72}
      />
      <PasswordField label="Yeni şifre tekrar" value={repeat} onChangeText={onRepeat} autoComplete="new-password" textContentType="newPassword" maxLength={72} />
      {repeat && value !== repeat ? <AppText style={{ color: colors.red700, fontSize: 13, marginTop: -6 }}>Şifreler aynı değil.</AppText> : null}
    </>
  );
}

const checkNew = (value: string, repeat: string) =>
  value.length < MIN ? `Yeni şifre en az ${MIN} karakter olmalı.` : value !== repeat ? 'Yeni şifreler aynı değil.' : null;

function ChangeForm({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!current) return setError('Şu anki şifreni yaz.');
    const problem = checkNew(next, repeat);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const tokens = await api.request<AuthTokens>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      await storeTokens(tokens);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Şifre değiştirilemedi, tekrar dene.');
      setBusy(false);
    }
  }

  return (
    <Section title="Yeni şifren">
      <PasswordField label="Şu anki şifren" value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" maxLength={72} />
      <NewPasswordFields value={next} repeat={repeat} onChange={setNext} onRepeat={setRepeat} />
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Şifremi değiştir" loading={busy} onPress={() => void submit()} />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onForgot} style={{ alignSelf: 'center', paddingVertical: 4 }}>
        <AppText weight="semibold" style={{ color: colors.brand700 }}>
          Şu anki şifremi hatırlamıyorum
        </AppText>
      </Pressable>
    </Section>
  );
}

/** E-postaya gelen 6 haneli kodla yeni şifre; sunucu tüm oturumları kapattığı için yeni şifreyle yeniden girilir */
function CodeForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { signIn } = useSession();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user.email) {
    return <Notice>Hesabında e-posta adresi yok. Kod gönderebilmemiz için önce e-posta adresini ekleyip doğrula.</Notice>;
  }
  const email = user.email;

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await api.request('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod gönderilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!/^\d{6}$/.test(code)) return setError('E-postana gelen 6 haneli kodu yaz.');
    const problem = checkNew(next, repeat);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await api.request('/auth/reset-password', { method: 'POST', body: { email, code, password: next } });
      await signIn(user.phone, next);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Şifre belirlenemedi, tekrar dene.');
      setBusy(false);
    }
  }

  if (!sent) {
    return (
      <Section title="E-postana kod gönderelim">
        <AppText>
          <AppText weight="semibold">{email}</AppText> adresine 6 haneli bir kod göndereceğiz. Kod 15 dakika geçerli.
        </AppText>
        {error ? <Notice>{error}</Notice> : null}
        <Button title="Kod gönder" icon="mail-outline" loading={busy} onPress={() => void send()} />
      </Section>
    );
  }
  return (
    <Section title="Yeni şifren">
      <AppText style={{ color: colors.zinc600 }}>
        <AppText weight="semibold">{email}</AppText> adresine kod gönderdik. Gelen kutunu ve spam klasörünü kontrol et.
      </AppText>
      <Field
        label="Doğrulama kodu"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
      />
      <NewPasswordFields value={next} repeat={repeat} onChange={setNext} onRepeat={setRepeat} />
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Şifreyi kaydet" loading={busy} onPress={() => void submit()} />
    </Section>
  );
}
