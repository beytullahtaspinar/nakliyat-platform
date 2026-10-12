import type { CompanyDocument, CompanyDocumentSummary, DocumentType } from '@nakliyat/api-client';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Badge, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_TYPES,
  MAX_OTHER_DOCUMENTS,
  REQUIREMENT_STATES,
  documentState,
  expiresSoon,
  formatBytes,
  formatDay,
  mimeOf,
  parseDay,
  uploadDocument,
  type PickedFile,
} from '@/lib/documents';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** Sitedeki /firma-paneli/belgeler: zorunlu ve isteğe bağlı belgeler, fotoğrafla ya da dosyadan yükleme */
export default function DocumentsScreen() {
  const { data, error, reload } = useApi<CompanyDocumentSummary>('/company/documents');
  const [notice, setNotice] = useState<string | null>(null);

  const missing = data ? data.requirements.filter((r) => r.state !== 'VERIFIED').length : 0;

  async function done(message: string) {
    setNotice(message);
    await reload();
  }

  return (
    <DetailScreen backLabel="Hesap" onRefresh={reload}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
          Belgeler
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          Teklif verebilmek için üç zorunlu belgeyi yükle. Ekibimiz belgeleri resmî kayıtlarla karşılaştırır. Belgelerini yalnızca sen ve
          platform yöneticileri görebilir.
        </AppText>
        {data ? (
          <AppText weight="semibold">
            {missing === 0
              ? 'Zorunlu belgelerinin hepsi onaylandı.'
              : `${data.requirements.length - missing}/${data.requirements.length} zorunlu belge onaylandı.`}
          </AppText>
        ) : null}
      </View>
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}

      {data
        ? DOCUMENT_TYPES.map((spec) => {
            const ofType = data.documents.filter((d) => d.type === spec.type);
            const requirement = data.requirements.find((r) => r.type === spec.type);
            const state = requirement?.state ?? (ofType[0] ? documentState(ofType[0]) : 'MISSING');
            const badge = REQUIREMENT_STATES[state];
            const canUpload = spec.type !== 'OTHER' || ofType.length < MAX_OTHER_DOCUMENTS;
            return (
              <Section key={spec.type} title={spec.label} description={`${spec.required ? 'Zorunlu' : 'İsteğe bağlı'}. ${spec.hint}`}>
                {(spec.required || ofType.length > 0) && spec.type !== 'OTHER' ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
                {ofType.map((d) => (
                  <DocumentRow
                    key={d.id}
                    document={d}
                    showState={ofType.length > 1 || spec.type === 'OTHER'}
                    onRemoved={() => done('Belge silindi.')}
                  />
                ))}
                {canUpload ? (
                  <UploadBox
                    type={spec.type}
                    dated={spec.dated}
                    replacing={ofType.length > 0 && spec.type !== 'OTHER'}
                    onUploaded={() => done('Belge yüklendi, incelemeye alındı.')}
                  />
                ) : null}
              </Section>
            );
          })
        : null}
    </DetailScreen>
  );
}

function DocumentRow({ document: d, showState, onRemoved }: { document: CompanyDocument; showState: boolean; onRemoved: () => Promise<void> }) {
  const state = REQUIREMENT_STATES[documentState(d)];
  const soon = d.status === 'VERIFIED' && !d.expired && expiresSoon(d.validUntil);

  function remove() {
    Alert.alert('Belgeyi sil', 'Bu belge silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          void api
            .request(`/company/documents/${encodeURIComponent(d.id)}`, { method: 'DELETE' })
            .then(onRemoved)
            .catch((e: unknown) => Alert.alert('Silinemedi', e instanceof Error ? e.message : 'Tekrar dene.')),
      },
    ]);
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.zinc100, paddingTop: 10, gap: 4 }}>
      <AppText
        weight="semibold"
        accessibilityRole="link"
        onPress={() => void Linking.openURL(d.url)}
        style={{ color: colors.brand700 }}
      >
        {d.fileName}
      </AppText>
      <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>
        {formatDate(d.createdAt)} · {formatBytes(d.sizeBytes)}
        {d.validUntil ? ` · Geçerlilik: ${formatDay(d.validUntil)}` : ''}
      </AppText>
      {d.status === 'REJECTED' && d.reviewNote ? (
        <AppText style={{ color: colors.red700, fontSize: 14 }}>Ret gerekçesi: {d.reviewNote}</AppText>
      ) : null}
      {soon ? <AppText style={{ color: colors.amber900, fontSize: 14 }}>Belgenin süresi yakında doluyor, yenisini yükle.</AppText> : null}
      {d.expired ? <AppText style={{ color: colors.red700, fontSize: 14 }}>Belgenin süresi dolmuş, yenisini yükle.</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {showState ? <Badge tone={state.tone}>{state.label}</Badge> : null}
        {d.status !== 'VERIFIED' ? (
          <Pressable accessibilityRole="button" onPress={remove} hitSlop={8}>
            <AppText weight="semibold" style={{ color: colors.red700, fontSize: 14 }}>
              Sil
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Belgenin fotoğrafını çek ya da telefondaki dosyayı seç; K3 için geçerlilik tarihini gir */
function UploadBox({
  type,
  dated,
  replacing,
  onUploaded,
}: {
  type: DocumentType;
  dated?: boolean;
  replacing: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(picked: PickedFile) {
    setError(null);
    if (!DOCUMENT_MIME_TYPES.includes(mimeOf(picked))) return setError('Belge PDF, JPG, PNG ya da WebP olmalı.');
    if (picked.size && picked.size > DOCUMENT_MAX_BYTES) {
      return setError("Dosya 10 MB'tan büyük. PDF'i sıkıştır ya da belgenin fotoğrafını çekip yükle.");
    }
    setFile(picked);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return setError('Fotoğraf çekmek için kamera izni gerekiyor. Telefon ayarlarından açabilir ya da dosya seçebilirsin.');
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      choose({ uri: asset.uri, name: asset.fileName ?? `belge-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
    }
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME_TYPES, copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) choose({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function submit() {
    if (!file) return setError('Önce belgenin fotoğrafını çek ya da dosyayı seç.');
    const day = dated ? parseDay(validUntil) : undefined;
    if (dated && !day) return setError('Geçerlilik bitiş tarihini GG.AA.YYYY biçiminde yaz.');
    setError(null);
    setBusy(true);
    try {
      await uploadDocument(file, type, day ?? undefined);
      setFile(null);
      setValidUntil('');
      await onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Belge yüklenemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10, backgroundColor: colors.zinc50, borderRadius: 12, padding: 12 }}>
      <AppText weight="medium">{replacing ? 'Yenisini yükle' : 'Belge yükle'}</AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Fotoğraf çek" kind="secondary" disabled={busy} onPress={() => void takePhoto()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Dosya seç" kind="secondary" disabled={busy} onPress={() => void pickFile()} />
        </View>
      </View>
      {file ? (
        <AppText style={{ color: colors.zinc600, fontSize: 14 }} numberOfLines={1}>
          Seçilen: {file.name}
          {file.size ? ` (${formatBytes(file.size)})` : ''}
        </AppText>
      ) : null}
      {dated ? (
        <Field
          label="Geçerlilik bitişi (GG.AA.YYYY)"
          value={validUntil}
          onChangeText={setValidUntil}
          keyboardType="numbers-and-punctuation"
          placeholder="31.12.2029"
          maxLength={10}
        />
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Yükle" loading={busy} disabled={!file} onPress={() => void submit()} />
    </View>
  );
}
