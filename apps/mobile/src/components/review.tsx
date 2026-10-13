import Ionicons from '@expo/vector-icons/Ionicons';
import type { OwnReview, ReviewExcerpt as Excerpt } from '@nakliyat/api-client';
import { useState } from 'react';
import { View } from 'react-native';
import { ReportButton } from '@/components/report';
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

const monthFormat = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

/**
 * Teklif kartında firmanın en yeni yorumundan alıntı: fiyatın yanında firmayla gerçekten taşınan
 * birinin sözü. Puana göre seçilmez (iyi ya da kötü, en güncel yorum).
 */
export function ReviewExcerpt({ review }: { review: Excerpt }) {
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: colors.amber500, backgroundColor: colors.zinc50, borderRadius: 8, padding: 10, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Stars rating={review.rating} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="shield-checkmark" size={14} color={colors.green700} />
          <AppText weight="semibold" style={{ color: colors.green700, fontSize: 12 }}>
            Doğrulanmış taşıma
          </AppText>
        </View>
      </View>
      <AppText style={{ fontSize: 14, lineHeight: 20 }}>{`“${review.excerpt}”`}</AppText>
      <AppText style={{ color: colors.zinc600, fontSize: 12 }}>
        {`${review.authorName} · ${review.route} · ${monthFormat.format(new Date(review.moveDate))}`}
      </AppText>
    </View>
  );
}

const REPLY_MAX = 1000;

/**
 * Değerlendirme ve firmanın tek yanıtı. Müşteri yorumunu yanıttan sonra düzenlediyse firma yanıtını
 * bir kez daha güncelleyebilir.
 */
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText style={{ color: colors.zinc500, fontSize: 13 }}>
          {formatDate(review.createdAt)}
          {review.editedAt ? ` · düzenlendi ${formatDate(review.editedAt)}` : ''}
        </AppText>
        {review.comment && review.isPublished ? <ReportButton target="REVIEW" targetId={review.id} compact /> : null}
      </View>
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
          {review.replyOutdated ? (
            <AppText style={{ color: colors.zinc600, fontSize: 13 }}>
              Müşteri yorumunu yanıtından sonra düzenledi; yanıtını yeni metne göre güncelleyebilirsin.
            </AppText>
          ) : null}
        </View>
      ) : null}
      {review.companyReply && !review.replyOutdated ? null : open ? (
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
            {review.companyReply
              ? 'Eski yanıtının yerine geçer. Müşteri yorumunu yeniden düzenlemedikçe tekrar değiştirilemez. Müşterinin adını, adresini yazma.'
              : 'Firma sayfasında yorumun altında herkese açık görünür ve sonradan değiştirilemez. Müşterinin adını, adresini yazma.'}
          </AppText>
          {error ? <Notice>{error}</Notice> : null}
          <Button title={review.companyReply ? 'Yanıtı güncelle' : 'Yanıtı yayımla'} loading={saving} onPress={() => void send()} />
          <Button title="Vazgeç" kind="secondary" onPress={() => setOpen(false)} />
        </View>
      ) : (
        <Button title={review.companyReply ? 'Yanıtını güncelle' : 'Yanıtla'} kind="secondary" onPress={() => setOpen(true)} />
      )}
    </View>
  );
}
