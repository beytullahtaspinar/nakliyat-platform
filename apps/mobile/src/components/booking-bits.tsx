import Ionicons from '@expo/vector-icons/Ionicons';
import type { RequestMedia } from '@nakliyat/api-client';
import * as Linking from 'expo-linking';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme';

/** Ayrıntı ekranlarındaki büyük kısayol düğmesi (Ara, Mesajlar, Yol tarifi) */
export function QuickAction({
  icon,
  label,
  highlight,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: highlight ? colors.accent500 : colors.zinc200,
        backgroundColor: pressed ? colors.zinc100 : highlight ? colors.accent50 : colors.white,
      })}
    >
      <Ionicons name={icon} size={22} color={highlight ? colors.accent700 : colors.brand700} />
      <AppText weight="semibold" style={{ fontSize: 13, color: highlight ? colors.accent700 : colors.brand700 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Etiket + değer satırı */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <AppText style={{ width: 80, color: colors.zinc500 }}>{label}</AppText>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <AppText>{children}</AppText> : children}</View>
    </View>
  );
}

/** Anlaşmalı işin iptali gerekçeyle yapılır; önce düğmeyle açılır */
export function CancelForm({
  bookingId,
  consequence,
  placeholder,
  onCancelled,
}: {
  bookingId: string;
  consequence: string;
  placeholder: string;
  onCancelled: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return <Button title="Taşımayı iptal et" kind="secondary" onPress={() => setOpen(true)} />;

  async function submit() {
    if (reason.trim().length < 5) return setError('İptal nedenini en az 5 karakterle yaz.');
    setError(null);
    setSaving(true);
    try {
      await api.request(`/bookings/${bookingId}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      await onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İptal edilemedi, tekrar dene.');
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 10, backgroundColor: colors.red50, borderRadius: 12, padding: 12 }}>
      <AppText style={{ color: colors.red700 }}>{consequence}</AppText>
      <Field
        label="İptal nedeni"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        placeholder={placeholder}
        style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {error ? <Notice>{error}</Notice> : null}
      <Button
        title="Taşımayı iptal et"
        loading={saving}
        onPress={() =>
          Alert.alert('Taşımayı iptal et', 'Bu işlem geri alınamaz.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Evet, iptal et', style: 'destructive', onPress: () => void submit() },
          ])
        }
      />
      <Button title="Vazgeç" kind="secondary" onPress={() => setOpen(false)} />
    </View>
  );
}

/** Fotoğraflar küçük resim; dokununca tam boy (videolar dahil) tarayıcıda açılır. onRemove verilirse silme düğmesi çıkar. */
export function MediaStrip({ media, onRemove }: { media: RequestMedia[]; onRemove?: (m: RequestMedia) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {media.map((m, i) => (
        <View key={m.id}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${m.type === 'VIDEO' ? 'Video' : 'Fotoğraf'} ${i + 1}, büyük aç`}
            onPress={() => void Linking.openURL(m.url)}
            style={{
              width: 112,
              height: 112,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: colors.zinc100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {m.type === 'PHOTO' ? (
              <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Ionicons name="play-circle" size={40} color={colors.brand700} />
            )}
          </Pressable>
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${m.type === 'VIDEO' ? 'Video' : 'Fotoğraf'} ${i + 1}, sil`}
              hitSlop={6}
              onPress={() => onRemove(m)}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.red700} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
