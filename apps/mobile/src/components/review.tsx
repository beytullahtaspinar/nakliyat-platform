import Ionicons from '@expo/vector-icons/Ionicons';
import type { OwnReview } from '@nakliyat/api-client';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

export function Stars({ rating }: { rating: number }) {
  return (
    <View accessible accessibilityLabel={`5 üzerinden ${rating} puan`} style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={18} color={colors.amber500} />
      ))}
    </View>
  );
}

const REPLY_MAX = 1000;

/** Değerlendirme ve firmanın tek yanıtı (sonradan değiştirilemez) */
export function ReviewBlock({ review, onReplied }: { review: OwnReview; onReplied: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send() {
    if (body.trim().length < 2) return setError('Yanıtın en az 2 karakter olmalı.');
    setError(null);
    setSaving(true);
    try {
      await api.request(`/company/reviews/${review.id}/reply`, { method: 'POST', body: { body: body.trim() } });
      await onReplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yanıt gönderilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Stars rating={review.rating} />
      <AppText style={{ color: review.comment ? colors.zinc900 : colors.zinc600 }}>{review.comment || 'Yorum yazılmadı.'}</AppText>
      <AppText style={{ color: colors.zinc500, fontSize: 13 }}>{formatDate(review.createdAt)}</AppText>
      {!review.isPublished ? (
        <Notice tone="info">
          {`Bu yorum yönetim tarafından yayından kaldırıldı ve puan ortalamana girmiyor.${
            review.hiddenReason ? ` Gerekçe: ${review.hiddenReason}` : ''
          }`}
        </Notice>
      ) : null}
      {review.companyReply ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: colors.brand700, paddingLeft: 12, gap: 2 }}>
          <AppText weight="semibold" style={{ fontSize: 14 }}>
            Yanıtın
          </AppText>
          <AppText>{review.companyReply}</AppText>
        </View>
      ) : open ? (
        <View style={{ gap: 10 }}>
          <Field
            label="Yanıtın"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={REPLY_MAX}
            style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>
            Firma sayfasında yorumun altında herkese açık görünür ve sonradan değiştirilemez. Müşterinin adını, adresini yazma.
          </AppText>
          {error ? <Notice>{error}</Notice> : null}
          <Button title="Yanıtı yayımla" loading={saving} onPress={() => void send()} />
          <Button title="Vazgeç" kind="secondary" onPress={() => setOpen(false)} />
        </View>
      ) : (
        <Button title="Yanıtla" kind="secondary" onPress={() => setOpen(true)} />
      )}
    </View>
  );
}
