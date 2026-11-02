import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Badge, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/bookings';
import { openSupportMail, SUPPORT_EMAIL } from '@/lib/legal';
import { useSession, useUser } from '@/lib/session';
import { colors } from '@/theme';

/**
 * Hesap bilgileri (sitedeki /hesabim/hesap): ad soyad değiştirme, telefon ve e-posta. E-posta Bildirim
 * tercihlerinden değişir; telefon değişikliği destek üzerinden yapılır.
 */
export function ProfileScreen({ backLabel, nameHint }: { backLabel: string; nameHint: string }) {
  const user = useUser();
  const { reload } = useSession();
  const [name, setName] = useState(user.fullName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim().replace(/\s+/g, ' ');
  const changed = trimmed !== user.fullName;

  async function save() {
    if (trimmed.length < 3) return setError('Ad soyad en az 3 karakter olmalı.');
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await api.request('/auth/me', { method: 'PATCH', body: { fullName: trimmed } });
      await reload();
      setName(trimmed);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ad kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailScreen backLabel={backLabel} onRefresh={reload}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
          Hesap bilgileri
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>Adın ve iletişim bilgilerin</AppText>
      </View>

      <Section title="Kişisel bilgiler">
        <Field
          label="Ad soyad"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSaved(false);
          }}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={100}
        />
        <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18, marginTop: -4 }}>{nameHint}</AppText>
        {error ? <Notice>{error}</Notice> : null}
        {saved ? <Notice tone="info">Adın kaydedildi.</Notice> : null}
        <Button title="Adı kaydet" loading={busy} disabled={!changed} onPress={() => void save()} />
      </Section>

      <Section title="İletişim bilgileri">
        <InfoRow label="Cep telefonu" value={formatPhone(user.phone)} verified={user.phoneVerified ? true : undefined} />
        <InfoRow label="E-posta" value={user.email ?? 'Eklenmedi'} verified={user.email ? user.emailVerified : undefined} />
        <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>
          E-posta adresini Bildirim tercihlerinden değiştirebilirsin; yeni adresi doğrulaman gerekir. Telefon numaranı değiştirmek için{' '}
          <AppText weight="semibold" accessibilityRole="link" onPress={openSupportMail} style={{ color: colors.brand700, fontSize: 13 }}>
            {SUPPORT_EMAIL}
          </AppText>{' '}
          adresine yaz.
        </AppText>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/bildirimler')} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
          <AppText weight="semibold" style={{ color: colors.brand700 }}>
            Bildirim tercihlerine git
          </AppText>
        </Pressable>
      </Section>
    </DetailScreen>
  );
}

function InfoRow({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText style={{ color: colors.zinc500, fontSize: 13 }}>{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <AppText weight="semibold" style={{ flexShrink: 1 }}>
          {value}
        </AppText>
        {verified === undefined ? null : <Badge tone={verified ? 'success' : 'warning'}>{verified ? 'Doğrulandı' : 'Doğrulanmadı'}</Badge>}
      </View>
    </View>
  );
}
