import Ionicons from '@expo/vector-icons/Ionicons';
import type { City, CreateRequestInput, District, MovingRequest } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useDialog } from '@/components/dialog';
import { LocationPicker, RouteMapView } from '@/components/map';
import { PanelScreen, Section } from '@/components/panel';
import { DateField, SelectField, type Option } from '@/components/pickers';
import { AppText, Button, Checkbox, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import type { LatLng } from '@/lib/geo';
import { addDays, formatDayTitle, todayInTurkey } from '@/lib/calendar';
import { MAX_PHOTOS, pickPhotos, uploadPhotos, type PreparedPhoto } from '@/lib/request-media';
import { colors } from '@/theme';

// Seçenekler sitedeki apps/web/src/lib/request-options.ts ile aynı
const HOME_TYPES: Option<string>[] = [
  { value: 'STUDIO', label: 'Stüdyo (1+0)' },
  { value: 'ONE_PLUS_ONE', label: '1+1' },
  { value: 'TWO_PLUS_ONE', label: '2+1' },
  { value: 'THREE_PLUS_ONE', label: '3+1' },
  { value: 'FOUR_PLUS_ONE', label: '4+1 ve üzeri' },
  { value: 'VILLA', label: 'Villa / müstakil ev' },
  { value: 'OFFICE', label: 'Ofis / iş yeri' },
];

const FLOORS: Option<number>[] = [
  { value: -1, label: 'Bodrum kat' },
  { value: 0, label: 'Zemin / bahçe katı' },
  ...Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: `${i + 1}. kat` })),
];

type Stop = {
  cityCode: string | null;
  district: string | null;
  address: string;
  /** Haritada işaretlenen nokta (isteğe bağlı); il veya ilçe değişince silinir */
  pin: (LatLng & { label: string | null }) | null;
  floor: number | null;
  elevator: boolean;
};
const emptyStop = (): Stop => ({ cityCode: null, district: null, address: '', pin: null, floor: null, elevator: false });

/** Taşıma talebi formu (sitedeki /talep-olustur). Doğrulanmamış hesapta talep taslak kalır. */
export default function NewRequestScreen() {
  const dialog = useDialog();
  const [cities, setCities] = useState<City[]>([]);
  const [from, setFrom] = useState<Stop>(emptyStop);
  const [to, setTo] = useState<Stop>(emptyStop);
  const [homeType, setHomeType] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [flexible, setFlexible] = useState(false);
  const [packing, setPacking] = useState(false);
  const [assembly, setAssembly] = useState(false);
  const [storage, setStorage] = useState(false);
  const [specialItems, setSpecialItems] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'sending' | 'uploading'>('idle');

  const today = todayInTurkey();
  const minDate = addDays(today, 1);
  const maxDate = addDays(today, 365);

  useEffect(() => {
    api
      .request<City[]>('/locations/cities')
      .then(setCities)
      .catch(() => setError('İl listesi yüklenemedi. Bağlantını kontrol edip ekranı yenile.'));
  }, []);

  const cityOptions = cities.map((c) => ({ value: c.code, label: c.name }));

  async function addPhotos(source: 'library' | 'camera') {
    setError(null);
    setPreparing(true);
    try {
      const picked = await pickPhotos(source, MAX_PHOTOS - photos.length);
      setPhotos((list) => [...list, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fotoğraf eklenemedi.');
    } finally {
      setPreparing(false);
    }
  }

  function validate(): CreateRequestInput | string {
    for (const [label, s] of [
      ['Çıkış', from],
      ['Varış', to],
    ] as const) {
      if (!s.cityCode || !s.district) return `${label} için il ve ilçe seç.`;
      if (s.floor === null) return `${label} için kat seç.`;
    }
    if (!homeType) return 'Ev tipini seç.';
    if (!moveDate) return 'Taşınma tarihini seç.';
    const items = specialItems
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 20) return 'En fazla 20 özel eşya yazabilirsin.';
    return {
      fromCityCode: from.cityCode!,
      fromDistrict: from.district!,
      ...(from.address.trim() && { fromAddress: from.address.trim() }),
      ...(from.pin && { fromLat: round(from.pin.lat), fromLng: round(from.pin.lng) }),
      fromFloor: from.floor!,
      fromHasElevator: from.elevator,
      toCityCode: to.cityCode!,
      toDistrict: to.district!,
      ...(to.address.trim() && { toAddress: to.address.trim() }),
      ...(to.pin && { toLat: round(to.pin.lat), toLng: round(to.pin.lng) }),
      toFloor: to.floor!,
      toHasElevator: to.elevator,
      homeType,
      moveDate,
      isDateFlexible: flexible,
      needsPacking: packing,
      needsAssembly: assembly,
      needsStorage: storage,
      ...(items.length && { specialItems: items.map((i) => i.slice(0, 100)) }),
      ...(notes.trim() && { notes: notes.trim() }),
    };
  }

  function reset() {
    setFrom(emptyStop());
    setTo(emptyStop());
    setHomeType(null);
    setMoveDate('');
    setFlexible(false);
    setPacking(false);
    setAssembly(false);
    setStorage(false);
    setSpecialItems('');
    setNotes('');
    setPhotos([]);
  }

  async function submit() {
    const input = validate();
    if (typeof input === 'string') return setError(input);
    setError(null);
    setStep('sending');
    let created: MovingRequest;
    try {
      created = await api.request<MovingRequest>('/requests', { method: 'POST', body: input });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Talep oluşturulamadı, tekrar dene.');
      setStep('idle');
      return;
    }
    // Talep oluştu; fotoğraflar yüklenemezse talep sayfasından yeniden eklenebilir
    let mediaMissing = false;
    if (photos.length) {
      setStep('uploading');
      mediaMissing = await uploadPhotos(created.id, photos)
        .then((r) => r.failed > 0)
        .catch(() => true);
    }
    reset();
    setStep('idle');
    router.push({ pathname: '/taleplerim/[id]', params: { id: created.id, yeni: '1', ...(mediaMissing && { medya: 'eksik' }) } });
    if (created.status === 'DRAFT') router.push('/dogrulama');
  }

  const busy = step !== 'idle';
  return (
    <PanelScreen title="Teklif al" form>
      <AppText style={{ color: colors.zinc600 }}>
        Taşınma bilgilerini gir, bölgendeki onaylı nakliyat firmaları sana ücretsiz teklif göndersin. Açık adresin, konumun
        ve telefonun yalnızca teklifini kabul ettiğin firmayla paylaşılır.
      </AppText>

      <Section title="Nereden taşınıyorsun?">
        <StopFields title="Çıkış konumu" stop={from} onChange={setFrom} cities={cityOptions} />
      </Section>
      <Section title="Nereye taşınıyorsun?">
        <StopFields title="Varış konumu" stop={to} onChange={setTo} cities={cityOptions} />
      </Section>

      <Section title="Ev tipi ve tarih">
        <SelectField label="Ev tipi" value={homeType} options={HOME_TYPES} onChange={setHomeType} />
        <DateField label="Taşınma tarihi" value={moveDate} min={minDate} max={maxDate} onChange={setMoveDate} />
        <AppText style={{ color: colors.zinc500, fontSize: 13, lineHeight: 18 }}>
          En erken yarın; firmaların teklif verebilmesi için zaman gerekir.
        </AppText>
        <Checkbox label="Tarihim esnek, birkaç gün önce veya sonra da olabilir" checked={flexible} onChange={setFlexible} />
      </Section>

      <Section title="Ek hizmetler">
        <Checkbox label="Eşyalarımı firma paketlesin" checked={packing} onChange={setPacking} />
        <Checkbox label="Mobilya söküm ve kurulumu (dolap, yatak vb.)" checked={assembly} onChange={setAssembly} />
        <Checkbox label="Eşyalarımın bir süre depoda kalması gerekiyor" checked={storage} onChange={setStorage} />
      </Section>

      <Section
        title="Eşyalarının fotoğrafları"
        description="İsteğe bağlı. Firmalar eşyaları görünce daha doğru fiyat verir. Adres veya kapı numarası görünmemesine dikkat et."
      >
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.map((p, i) => (
              <View key={p.uri}>
                <Image source={{ uri: p.uri }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.zinc100 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Fotoğraf ${i + 1}, çıkar`}
                  hitSlop={6}
                  disabled={busy}
                  onPress={() => setPhotos((list) => list.filter((x) => x !== p))}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.zinc900} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <AppText style={{ color: colors.zinc500, fontSize: 13 }}>
          {photos.length}/{MAX_PHOTOS} fotoğraf
        </AppText>
        {photos.length < MAX_PHOTOS ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Galeri" icon="images-outline" kind="secondary" loading={preparing} disabled={busy} onPress={() => void addPhotos('library')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Kamera" icon="camera-outline" kind="secondary" disabled={busy || preparing} onPress={() => void addPhotos('camera')} />
            </View>
          </View>
        ) : null}
      </Section>

      <Section title="Ek bilgiler">
        <Field
          label="Özel eşyalar (isteğe bağlı)"
          placeholder="Virgülle ayır: piyano, antika vitrin, kasa"
          value={specialItems}
          onChangeText={setSpecialItems}
          maxLength={1000}
        />
        <Field
          label="Firmalara notun (isteğe bağlı)"
          placeholder="Örnek: sokak dar, kamyon girmiyor; bina girişinde 5 basamak var."
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={2000}
          style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Section>

      {error ? <Notice>{error}</Notice> : null}
      {step === 'uploading' ? <Notice tone="info">Talebin oluşturuldu, fotoğraflar yükleniyor…</Notice> : null}
      <Button
        title="Ücretsiz teklif iste"
        loading={busy}
        disabled={preparing}
        onPress={() => {
          const input = validate();
          if (typeof input === 'string') return setError(input);
          setError(null);
          void dialog
            .confirm({
              title: 'Talebin gönderilsin mi?',
              message: `${summary(input, cities)}\n\nTalebin bölgendeki onaylı firmalara iletilecek. Teklifler geldikçe sana haber vereceğiz.`,
              confirmLabel: 'Gönder',
              cancelLabel: 'Kontrol et',
              icon: 'paper-plane-outline',
            })
            .then((ok) => {
              if (ok) void submit();
            });
        }}
      />
    </PanelScreen>
  );
}

/** İl, ilçe, açık adres, kat ve asansör. İl değişince ilçe listesi yeniden yüklenir. */
function StopFields({ title, stop, onChange, cities }: { title: string; stop: Stop; onChange: (s: Stop) => void; cities: Option<string>[] }) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const districtName = districts.find((d) => d.slug === stop.district)?.name;
  const cityName = cities.find((c) => c.value === stop.cityCode)?.label;

  useEffect(() => {
    setDistricts([]);
    setFailed(false);
    if (!stop.cityCode) return;
    let active = true;
    api
      .request<District[]>(`/locations/cities/${stop.cityCode}/districts`)
      .then((list) => active && setDistricts(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [stop.cityCode]);

  return (
    <>
      <SelectField
        label="İl"
        value={stop.cityCode}
        options={cities}
        placeholder="İl seç"
        searchable
        onChange={(cityCode) => onChange({ ...stop, cityCode, district: null, pin: null })}
      />
      <SelectField
        label="İlçe"
        value={stop.district}
        options={districts.map((d) => ({ value: d.slug, label: d.name }))}
        placeholder={stop.cityCode ? 'İlçe seç' : 'Önce il seç'}
        disabled={!stop.cityCode || districts.length === 0}
        searchable
        onChange={(district) => onChange({ ...stop, district, pin: district === stop.district ? stop.pin : null })}
      />
      {failed ? <Notice>İlçeler yüklenemedi, ili yeniden seç.</Notice> : null}
      <Field
        label="Açık adres (isteğe bağlı)"
        placeholder="Mahalle, cadde/sokak, bina ve daire no"
        value={stop.address}
        onChangeText={(address) => onChange({ ...stop, address })}
        maxLength={300}
      />
      {stop.pin ? (
        <View style={{ gap: 8 }}>
          <RouteMapView from={stop.pin} to={null} height={140} />
          <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {stop.pin.label ? `İşaretlenen yer: ${stop.pin.label}` : 'Konum işaretlendi.'}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TextLink label="Konumu değiştir" onPress={() => setPicking(true)} />
            <TextLink label="İşareti kaldır" onPress={() => onChange({ ...stop, pin: null })} />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!stop.district}
          onPress={() => setPicking(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.zinc300,
            backgroundColor: pressed ? colors.brand50 : colors.white,
            opacity: stop.district ? 1 : 0.5,
          })}
        >
          <Ionicons name="map-outline" size={22} color={colors.brand700} />
          <View style={{ flex: 1 }}>
            <AppText weight="semibold" style={{ color: colors.brand700 }}>
              Haritada işaretle (isteğe bağlı)
            </AppText>
            <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>
              {stop.district ? 'Gerçek yol mesafesi hesaplanır, firman kapını kolay bulur.' : 'Önce il ve ilçe seç.'}
            </AppText>
          </View>
        </Pressable>
      )}
      <LocationPicker
        visible={picking}
        title={title}
        value={stop.pin}
        address={stop.address}
        area={[districtName, cityName].filter(Boolean).join(', ')}
        onClose={() => setPicking(false)}
        onPick={(p) =>
          onChange({
            ...stop,
            pin: { lat: p.lat, lng: p.lng, label: p.label },
            // Açık adres boşsa haritada bulunan sokak yazılır; müşteri sonra düzenleyebilir
            address: stop.address.trim() || !p.street ? stop.address : p.street,
          })
        }
      />
      <SelectField label="Kat" value={stop.floor} options={FLOORS} placeholder="Kat seç" onChange={(floor) => onChange({ ...stop, floor })} />
      <Checkbox label="Binada asansör var" checked={stop.elevator} onChange={(elevator) => onChange({ ...stop, elevator })} />
    </>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <AppText weight="semibold" style={{ color: colors.brand700, fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** API'ye 6 basamak yeter (~10 cm) */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Onay penceresindeki kısa özet: Kadıköy, İstanbul → Çankaya, Ankara · 3+1 · 14 Kasım */
function summary(input: CreateRequestInput, cities: City[]) {
  const city = (code: string) => cities.find((c) => c.code === code)?.name ?? '';
  const home = HOME_TYPES.find((h) => h.value === input.homeType)?.label ?? '';
  return `${city(input.fromCityCode)} → ${city(input.toCityCode)} · ${home} · ${formatDayTitle(input.moveDate)}`;
}
