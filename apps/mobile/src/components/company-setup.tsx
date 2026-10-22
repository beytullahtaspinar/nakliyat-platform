import type { City } from '@nakliyat/api-client';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PanelScreen } from '@/components/panel';
import { MultiSelectField, SelectField } from '@/components/pickers';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme';

/**
 * Firma profili olmayan firma hesabı (ör. Google / Apple ile uygulamadan açılan): sitedeki /firma-paneli
 * ilk ekranının karşılığı. Profil açılınca panel görünür; belgeler Hesap → Belgeler'den, araç Hesap → Araçlar'dan yüklenir.
 */
export function CompanySetupScreen({ onCreated }: { onCreated: () => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [k3, setK3] = useState('');
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [service, setService] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .request<City[]>('/locations/cities', { auth: false })
      .then(setCities)
      .catch(() => setError('İller yüklenemedi. Bağlantını kontrol edip tekrar dene.'));
  }, []);

  const options = cities.map((c) => ({ value: c.code, label: c.name }));

  async function submit() {
    if (legalName.trim().length < 3) return setError('Vergi levhasındaki ticari unvanı yaz.');
    if (displayName.trim().length < 2) return setError('Müşterilerin göreceği firma adını yaz.');
    if (!/^\d{10,11}$/.test(taxNumber.trim())) return setError('Vergi numarası 10, TC kimlik no 11 haneli olmalı.');
    if (!cityCode) return setError('Merkez ili seç.');
    setError(null);
    setLoading(true);
    try {
      await api.request('/company/profile', {
        method: 'POST',
        body: {
          legalName: legalName.trim(),
          displayName: displayName.trim(),
          taxNumber: taxNumber.trim(),
          ...(k3.trim() && { k3LicenseNumber: k3.trim() }),
          cityCode,
          // Merkez il her zaman hizmet illerinden biri (sitedeki formla aynı)
          serviceCityCodes: [...new Set([cityCode, ...service])],
        },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Firma kaydedilemedi, tekrar dene.');
      setLoading(false);
    }
  }

  return (
    <PanelScreen title="Firma bilgileri" form>
      <AppText style={{ color: colors.zinc600 }}>
        Firmanı kaydet; ardından K3 yetki belgeni, vergi levhanı, ticaret sicil belgeni ve yetki belgene kayıtlı aracının ruhsatıyla
        fotoğraflarını yükle. Yönetim onaylayınca bölgendeki taleplere teklif verebilirsin.
      </AppText>
      <Field label="Ticari unvan" placeholder="Vergi levhasındaki unvan" value={legalName} onChangeText={setLegalName} maxLength={200} />
      <Field label="Görünen ad" placeholder="Müşterilerin göreceği ad" value={displayName} onChangeText={setDisplayName} maxLength={80} />
      <Field
        label="Vergi numarası"
        placeholder="10 hane; şahıs şirketiyse TC kimlik no"
        value={taxNumber}
        onChangeText={setTaxNumber}
        keyboardType="number-pad"
        maxLength={11}
      />
      <Field label="K3 yetki belgesi no (isteğe bağlı)" placeholder="K3.34.123456" value={k3} onChangeText={setK3} autoCapitalize="characters" maxLength={50} />
      <SelectField label="Merkez il" value={cityCode} options={options} onChange={setCityCode} placeholder="İl seç" searchable />
      <View style={{ gap: 4 }}>
        <MultiSelectField
          label="Hizmet verdiğin iller"
          values={cityCode ? [...new Set([cityCode, ...service])] : service}
          options={options}
          onChange={setService}
          allLabel="Tüm Türkiye"
          placeholder="Yalnızca merkez il"
          searchable
        />
        <AppText style={{ color: colors.zinc500, fontSize: 13 }}>
          Bu illerden çıkan veya bu illere giden talepleri görürsün. Merkez il her zaman dahildir.
        </AppText>
      </View>
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Firmayı kaydet" loading={loading} onPress={() => void submit()} />
    </PanelScreen>
  );
}
