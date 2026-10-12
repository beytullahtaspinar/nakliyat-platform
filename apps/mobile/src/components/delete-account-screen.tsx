import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/** Uygulama içinden hesap silme (App Store ve Google Play şartı); sitedeki /hesap-silme ile aynı işi yapar */
export function DeleteAccountScreen({ backLabel, deleted, kept }: { backLabel: string; deleted: string[]; kept: string }) {
  const user = useUser();
  const { deleteAccount } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      // Başarılıysa oturum kapanır ve giriş ekranına dönülür
      await deleteAccount(user.hasPassword ? password : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hesap silinemedi, tekrar dene.');
      setBusy(false);
    }
  }

  function confirm() {
    if (user.hasPassword && !password) return setError('Hesabın sana ait olduğunu doğrulamak için şifreni yaz.');
    Alert.alert('Hesabın kalıcı olarak silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Hesabımı sil', style: 'destructive', onPress: () => void run() },
    ]);
  }

  return (
    <DetailScreen backLabel={backLabel}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
          Hesabımı sil
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          Hesabın ve kişisel verilerin kalıcı olarak silinir. Planlanmış bir taşıma işin varsa iş tamamlandıktan ya da iptal
          edildikten sonra silebilirsin.
        </AppText>
      </View>

      <Section title="Neler silinir?">
        {deleted.map((line) => (
          <AppText key={line} style={{ color: colors.zinc900 }}>
            • {line}
          </AppText>
        ))}
      </Section>

      <Section title="Neler saklanır?">
        <AppText style={{ color: colors.zinc900 }}>{kept}</AppText>
      </Section>

      {user.hasPassword ? (
        <Field
          label="Şifren"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          maxLength={72}
        />
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Hesabımı kalıcı olarak sil" loading={busy} onPress={confirm} />
    </DetailScreen>
  );
}
