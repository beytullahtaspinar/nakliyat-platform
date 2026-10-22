import type { CompanyVehicle, CompanyVehicleSummary, VehicleFileKind, VehicleType } from '@nakliyat/api-client';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useDialog } from '@/components/dialog';
import { DetailScreen, Section } from '@/components/panel';
import { AppText, Badge, Button, Field, Notice, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { DOCUMENT_MIME_TYPES } from '@/lib/documents';
import { formatDate } from '@/lib/format';
import { VEHICLE_LABELS } from '@/lib/requests';
import { useApi } from '@/lib/use-api';
import {
  AUTHORIZATIONS,
  MAX_VEHICLES,
  PLATE_PATTERN,
  VEHICLE_FILES,
  VEHICLE_STATES,
  formatPlate,
  normalizePlate,
  saveVehicle,
  shrinkPhoto,
  type VehicleFile,
} from '@/lib/vehicles';
import { colors } from '@/theme';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = (['KAMYON', 'KAMYONET', 'PANELVAN', 'TIR'] as const).map((value) => ({
  value,
  label: VEHICLE_LABELS[value],
}));

/** Sitedeki /firma-paneli/araclar: yetki belgesine kayıtlı araçlar, ruhsat ve önden/yandan/arkadan fotoğraflar */
export default function VehiclesScreen() {
  const { data, error, reload } = useApi<CompanyVehicleSummary>('/company/vehicles');
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function done(message: string) {
    setNotice(message);
    setEditing(null);
    await reload();
  }

  return (
    <DetailScreen backLabel="Hesap" onRefresh={reload}>
      <View style={{ gap: 6 }}>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
          Araçlar
        </AppText>
        <AppText style={{ color: colors.zinc600 }}>
          Firmanın onaylanması için K3 ya da L1 yetki belgene kayıtlı en az bir aracın olmalı. Ruhsatını ve plakası okunacak şekilde
          önden, yandan, arkadan çekilmiş üç fotoğrafını yükle. Ekibimiz ruhsattaki plakayı fotoğraflardakiyle karşılaştırır.
        </AppText>
        {data ? (
          <AppText weight="semibold">
            {data.verifiedCount > 0
              ? `${data.verifiedCount} onaylı aracın var.`
              : data.vehicles.some((v) => v.status === 'PENDING')
                ? 'Aracın inceleniyor.'
                : 'Henüz onaylı aracın yok.'}
          </AppText>
        ) : null}
      </View>
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}

      {data?.vehicles.map((v) =>
        editing === v.id ? (
          <Section key={v.id} title={`${formatPlate(v.plate)} düzelt`}>
            <VehicleForm vehicle={v} onSaved={() => done('Düzeltme gönderildi, yeniden incelenecek.')} onCancel={() => setEditing(null)} />
          </Section>
        ) : (
          <VehicleCard key={v.id} vehicle={v} onEdit={() => setEditing(v.id)} onRemoved={() => done('Araç silindi.')} />
        ),
      )}

      {data && data.vehicles.length < MAX_VEHICLES ? (
        <Section title={data.vehicles.length ? 'Yeni araç ekle' : 'Araç ekle'} description="Fotoğrafları gün ışığında, plaka net görünecek şekilde çek.">
          <VehicleForm onSaved={() => done('Araç eklendi, incelemeye alındı.')} />
        </Section>
      ) : null}
    </DetailScreen>
  );
}

function VehicleCard({ vehicle: v, onEdit, onRemoved }: { vehicle: CompanyVehicle; onEdit: () => void; onRemoved: () => Promise<void> }) {
  const dialog = useDialog();
  const state = VEHICLE_STATES[v.status];

  function remove() {
    void dialog
      .confirm({
        title: 'Araç silinsin mi?',
        message: `${formatPlate(v.plate)} plakalı araç ve dosyaları silinecek.`,
        confirmLabel: 'Sil',
        destructive: true,
        icon: 'trash-outline',
        action: () => api.request(`/company/vehicles/${encodeURIComponent(v.id)}`, { method: 'DELETE' }),
      })
      .then((ok) => {
        if (ok) void onRemoved();
      });
  }

  return (
    <Section title={formatPlate(v.plate)} description={`${VEHICLE_LABELS[v.type]} · ${v.authorization} yetki belgesi · ${formatDate(v.createdAt)}`}>
      <Badge tone={state.tone}>{state.label}</Badge>
      {v.status === 'REJECTED' && v.reviewNote ? <Notice>{`Ret gerekçesi: ${v.reviewNote}. Düzeltip yeniden gönderebilirsin.`}</Notice> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VEHICLE_FILES.map((spec) => {
          const file = v.files.find((f) => f.kind === spec.kind);
          if (!file) return null;
          return (
            <Pressable
              key={spec.kind}
              accessibilityRole="link"
              accessibilityLabel={`${spec.label}: aç`}
              onPress={() => void Linking.openURL(file.url)}
              style={{ width: '48%', gap: 4 }}
            >
              <Thumb uri={file.mimeType.startsWith('image/') ? file.url : null} />
              <AppText style={{ fontSize: 13, color: colors.brand700 }}>{spec.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {v.status !== 'VERIFIED' ? (
          <View style={{ flex: 1 }}>
            <Button title="Düzelt" kind="secondary" onPress={onEdit} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button title="Sil" kind="secondary" onPress={remove} />
        </View>
      </View>
    </Section>
  );
}

function Thumb({ uri }: { uri: string | null }) {
  return (
    <View style={{ aspectRatio: 4 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.zinc100, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <AppText weight="semibold" style={{ color: colors.brand700 }}>
          PDF
        </AppText>
      )}
    </View>
  );
}

/** Araç ekleme ya da onaylanmamış aracı düzeltme. Fotoğraflar kameradan ya da galeriden; ruhsat PDF de olabilir. */
function VehicleForm({ vehicle, onSaved, onCancel }: { vehicle?: CompanyVehicle; onSaved: () => Promise<void>; onCancel?: () => void }) {
  const [plate, setPlate] = useState(vehicle ? formatPlate(vehicle.plate) : '');
  const [type, setType] = useState<VehicleType>(vehicle?.type ?? 'KAMYON');
  const [authorization, setAuthorization] = useState<string>(vehicle?.authorization ?? '');
  const [files, setFiles] = useState<Partial<Record<VehicleFileKind, VehicleFile>>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: VehicleFileKind, source: 'camera' | 'library' | 'file') {
    setError(null);
    try {
      let file: VehicleFile | null = null;
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME_TYPES, copyToCacheDirectory: true });
        const asset = result.canceled ? null : result.assets[0];
        if (asset) file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size };
      } else {
        const permission =
          source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          return setError(source === 'camera' ? 'Fotoğraf çekmek için kamera izni gerekiyor.' : 'Fotoğraf seçmek için fotoğraflarına erişim izni gerekiyor.');
        }
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        const asset = result.canceled ? null : result.assets[0];
        if (asset) {
          file = { uri: asset.uri, name: asset.fileName ?? `${kind.toLowerCase()}.jpg`, mimeType: asset.mimeType, width: asset.width, height: asset.height };
        }
      }
      if (!file) return;
      const pdf = (file.mimeType ?? '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
      const ready = pdf ? file : await shrinkPhoto(file, kind);
      setFiles((current) => ({ ...current, [kind]: ready }));
    } catch {
      setError('Dosya alınamadı, tekrar dene.');
    }
  }

  async function submit() {
    const normalized = normalizePlate(plate);
    if (!PLATE_PATTERN.test(normalized)) return setError('Plakayı ruhsattaki gibi yaz (ör. 34 ABC 123).');
    if (!authorization) return setError('Aracın kayıtlı olduğu yetki belgesini (K3 ya da L1) seç.');
    const missing = vehicle ? [] : VEHICLE_FILES.filter((f) => !files[f.kind]);
    if (missing.length) return setError(`Eksik: ${missing.map((f) => f.label.toLowerCase()).join(', ')}.`);
    setError(null);
    try {
      const fields = vehicle
        ? {
            ...(normalized !== vehicle.plate && { plate: normalized }),
            ...(type !== vehicle.type && { type }),
            ...(authorization !== vehicle.authorization && { authorization }),
          }
        : { plate: normalized, type, authorization };
      await saveVehicle(vehicle?.id ?? null, fields, files, setStatus);
      setFiles({});
      if (!vehicle) {
        setPlate('');
        setAuthorization('');
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Araç kaydedilemedi, tekrar dene.');
    } finally {
      setStatus(null);
    }
  }

  const busy = status !== null;
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Plaka (ruhsatta yazdığı gibi)"
        value={plate}
        onChangeText={(t) => setPlate(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="34 ABC 123"
        maxLength={14}
      />
      <View style={{ gap: 6 }}>
        <AppText weight="medium">Araç tipi</AppText>
        <Segmented options={VEHICLE_TYPES} value={type} onChange={setType} />
      </View>
      <View style={{ gap: 6 }}>
        <AppText weight="medium">Aracın kayıtlı olduğu yetki belgesi</AppText>
        <Segmented options={AUTHORIZATIONS} value={authorization as CompanyVehicle['authorization']} onChange={setAuthorization} />
      </View>
      {VEHICLE_FILES.map((spec) => {
        const chosen = files[spec.kind];
        const current = vehicle?.files.find((f) => f.kind === spec.kind);
        const preview = chosen ? (chosen.mimeType === 'image/jpeg' ? chosen.uri : null) : current?.mimeType.startsWith('image/') ? current.url : null;
        return (
          <View key={spec.kind} style={{ gap: 8, backgroundColor: colors.zinc50, borderRadius: 12, padding: 12 }}>
            <AppText weight="semibold">{spec.label}</AppText>
            <AppText style={{ color: colors.zinc600, fontSize: 14 }}>{spec.hint}</AppText>
            {chosen || current ? <Thumb uri={preview} /> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Fotoğraf çek" kind="secondary" disabled={busy} onPress={() => void pick(spec.kind, 'camera')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={spec.kind === 'REGISTRATION' ? 'Dosya seç' : 'Galeriden'}
                  kind="secondary"
                  disabled={busy}
                  onPress={() => void pick(spec.kind, spec.kind === 'REGISTRATION' ? 'file' : 'library')}
                />
              </View>
            </View>
          </View>
        );
      })}
      {error ? <Notice>{error}</Notice> : null}
      {status ? <AppText style={{ color: colors.zinc600 }}>{status}</AppText> : null}
      <Button title={status ?? (vehicle ? 'Düzeltmeyi gönder' : 'Aracı ekle')} loading={busy} onPress={() => void submit()} />
      {onCancel ? <Button title="Vazgeç" kind="secondary" disabled={busy} onPress={onCancel} /> : null}
    </View>
  );
}
