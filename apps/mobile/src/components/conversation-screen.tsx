import Ionicons from '@expo/vector-icons/Ionicons';
import type { BookingMessage, Conversation } from '@nakliyat/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/panel';
import { AppText, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMessageTime } from '@/lib/bookings';
import { colors, fonts, radius } from '@/theme';

/** Ekran açıkken yeni mesajlar bu aralıkla sorulur (sitedeki gibi; sunucuda soket yok) */
const POLL_MS = 10_000;
const MAX_LENGTH = 2000;

/**
 * Bir işe bağlı firma–müşteri yazışması (iki uygulamada ortak). Ekran açılınca karşı tarafın mesajları okundu sayılır.
 * id: iş (booking) kimliği
 */
export function ConversationScreen({ id, backLabel, emptyText }: { id: string; backLabel: string; emptyText: string }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.request<Conversation>(`/bookings/${encodeURIComponent(id)}/messages`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mesajlar yüklenemedi.');
    }
  }, [id]);

  // Ekran öndeyken ve uygulama açıkken düzenli yenile
  useFocusEffect(
    useCallback(() => {
      void load();
      let timer = setInterval(() => void load(), POLL_MS);
      const sub = AppState.addEventListener('change', (state) => {
        clearInterval(timer);
        if (state === 'active') {
          void load();
          timer = setInterval(() => void load(), POLL_MS);
        }
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [load]),
  );

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message = await api.request<BookingMessage>(`/bookings/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: { body },
      });
      setDraft('');
      setError(null);
      setData((d) => (d ? { ...d, items: [...d.items, message] } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mesaj gönderilemedi, tekrar dene.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.zinc50 }}>
      <BackHeader label={backLabel} title={data ? `${data.counterpart} ile mesajlar` : 'Mesajlar'} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {data && data.items.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>{emptyText}</AppText>
            </View>
          ) : null}
          {data?.items.map((m) => <Bubble key={m.id} message={m} />)}
        </ScrollView>

        {error ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Notice>{error}</Notice>
          </View>
        ) : null}

        {data && !data.canSend ? (
          <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.zinc200, backgroundColor: colors.white }}>
            <AppText style={{ color: colors.zinc600, textAlign: 'center' }}>Bu işte artık mesaj gönderilemiyor.</AppText>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 10 + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: colors.zinc200,
              backgroundColor: colors.white,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Mesajını yaz"
              placeholderTextColor={colors.zinc500}
              accessibilityLabel="Mesaj"
              multiline
              maxLength={MAX_LENGTH}
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 44,
                borderWidth: 1,
                borderColor: colors.zinc300,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                paddingTop: 11,
                paddingBottom: 11,
                fontSize: 16,
                fontFamily: fonts.regular,
                color: colors.zinc900,
                backgroundColor: colors.white,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gönder"
              accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
              disabled={!draft.trim() || sending}
              onPress={() => void send()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brand700,
                opacity: !draft.trim() || sending ? 0.5 : 1,
              }}
            >
              <Ionicons name="send" size={20} color={colors.white} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message: m }: { message: BookingMessage }) {
  return (
    <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '82%',
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: m.mine ? colors.brand700 : colors.white,
          borderWidth: m.mine ? 0 : 1,
          borderColor: colors.zinc200,
          borderBottomRightRadius: m.mine ? 4 : 16,
          borderBottomLeftRadius: m.mine ? 16 : 4,
        }}
      >
        <AppText style={{ color: m.mine ? colors.white : colors.zinc900 }}>
          {m.body || 'Bu mesaj silindi.'}
        </AppText>
      </View>
      <AppText style={{ fontSize: 12, lineHeight: 16, color: colors.zinc500, marginTop: 2 }}>
        {formatMessageTime(m.createdAt)}
        {m.mine && m.readAt ? ' · Okundu' : ''}
      </AppText>
    </View>
  );
}
