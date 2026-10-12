import { useState } from 'react';
import { View } from 'react-native';
import { useDialog } from '@/components/dialog';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Button, Notice, PasswordField } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/** Uygulama içinden hesap silme (App Store ve Google Play şartı); sitedeki /hesap-silme ile aynı işi yapar */
export function DeleteAccountScreen({ backLabel, deleted, kept }: { backLabel: string; deleted: string[]; kept: string }) {
  const user = useUser();
  const { deleteAccount } = useSession();
  const dialog = useDialog();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (user.hasPassword && !password) return setError('Hesabın sana ait olduğunu doğrulamak için şifreni yaz.');
    setError(null);
    // Başarılıysa oturum kapanır ve giriş ekranına dönülür; hata pencerede gösterilir
    void dialog.confirm({
      title: 'Hesabın kalıcı olarak silinsin mi?',
      message: 'Bu işlem geri alınamaz.',
      confirmLabel: 'Hesabımı sil',
      destructive: true,
      icon: 'trash-outline',
      action: () => deleteAccount(user.hasPassword ? password : undefined),
    });
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
        <PasswordField
          label="Şifren"
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          maxLength={72}
        />
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Hesabımı kalıcı olarak sil" kind="danger" onPress={confirm} />
    </DetailScreen>
  );
}
