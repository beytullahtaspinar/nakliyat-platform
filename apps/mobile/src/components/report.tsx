import Ionicons from '@expo/vector-icons/Ionicons';
import type { CreateReportInput, ReportReason, ReportTarget } from '@nakliyat/api-client';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, radius } from '@/theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'ABUSE', label: 'Hakaret ya da taciz' },
  { value: 'INAPPROPRIATE', label: 'Uygunsuz içerik' },
  { value: 'FRAUD', label: 'Dolandırıcılık şüphesi' },
  { value: 'SPAM', label: 'İstenmeyen ya da reklam' },
  { value: 'OTHER', label: 'Diğer' },
];

const NOTE_MAX = 500;

/**
 * Mesaj, yorum ya da firma yanıtını yönetime bildirme (App Store 1.2, Google Play kullanıcı içeriği kuralı).
 * Düğme kendi alttan açılan penceresini taşır; bildirim /yonetim/sikayetler ekranına düşer.
 */
export function ReportButton({ target, targetId, compact }: { target: ReportTarget; targetId: string; compact?: boolean }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function show() {
    setReason(null);
    setNote('');
    setError(null);
    setSent(false);
    setOpen(true);
  }

  async function send() {
    if (!reason) return setError('Bir neden seç.');
    setSending(true);
    setError(null);
    try {
      const body: CreateReportInput = { target, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) };
      await api.request('/reports', { method: 'POST', body });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bildirim gönderilemedi, tekrar dene.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bildir"
        hitSlop={8}
        onPress={show}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: compact ? 24 : 44 }}
      >
        <Ionicons name="flag-outline" size={compact ? 13 : 16} color={colors.zinc500} />
        <AppText style={{ color: colors.zinc500, fontSize: compact ? 12 : 14, lineHeight: compact ? 16 : 20 }}>Bildir</AppText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !sending && setOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityLabel="Kapat"
            onPress={() => !sending && setOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              gap: 14,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.zinc200 }} />
            {sent ? (
              <>
                <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
                  Bildirimin alındı
                </AppText>
                <AppText style={{ color: colors.zinc600 }}>
                  Ekibimiz en geç 24 saat içinde inceler. Kurallara aykırıysa içerik kaldırılır, gerekirse hesap kapatılır. Mesajlaşmada
                  bu kişiyi ayrıca engelleyebilirsin.
                </AppText>
                <Button title="Tamam" onPress={() => setOpen(false)} />
              </>
            ) : (
              <>
                <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
                  Neden bildiriyorsun?
                </AppText>
                <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
                  {REASONS.map((r) => {
                    const selected = reason === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => setReason(r.value)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          minHeight: 44,
                          paddingHorizontal: 12,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: selected ? colors.brand700 : colors.zinc200,
                          backgroundColor: selected ? colors.brand50 : colors.white,
                        }}
                      >
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? colors.brand700 : colors.zinc500}
                        />
                        <AppText>{r.label}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <Field
                  label="Açıklama (isteğe bağlı)"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={NOTE_MAX}
                  style={{ minHeight: 64, paddingTop: 12, textAlignVertical: 'top' }}
                />
                {error ? <Notice>{error}</Notice> : null}
                <Button title="Bildir" loading={sending} onPress={() => void send()} />
                <Button title="Vazgeç" kind="secondary" disabled={sending} onPress={() => setOpen(false)} />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
