import type { CompanyRequestDetail, OwnQuote, QuoteInput, VehicleType } from '@nakliyat/api-client';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Checkbox, Field, Notice, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCredits, VEHICLE_LABELS } from '@/lib/requests';
import { colors } from '@/theme';

const VEHICLES = (Object.keys(VEHICLE_LABELS) as VehicleType[]).map((value) => ({ value, label: VEHICLE_LABELS[value] }));

/** Sitedeki teklif formunun karşılığı (apps/web/src/app/firma-paneli/talepler/[id]/quote-form.tsx) */
export function QuoteForm({
  request,
  quote,
  onSaved,
}: {
  request: CompanyRequestDetail;
  quote: OwnQuote | null;
  onSaved: (notice: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(quote ? String(Math.round(Number(quote.priceTry))) : '');
  const [vehicle, setVehicle] = useState<VehicleType | null>(quote?.vehicleType ?? null);
  const [crew, setCrew] = useState(String(quote?.crewSize ?? request.estimatedCrew ?? 2));
  const [packing, setPacking] = useState(quote?.includesPacking ?? request.needsPacking);
  const [assembly, setAssembly] = useState(quote?.includesAssembly ?? request.needsAssembly);
  const [insurance, setInsurance] = useState(quote?.includesInsurance ?? false);
  const [message, setMessage] = useState(quote?.message ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { credit } = request;
  // Kredi yalnızca ilk teklifte düşer; güncelleme ücreti varsa API onu ayrıca söyler
  const charged = !quote && credit.enabled && credit.cost > 0;
  const short = charged && credit.balance < credit.cost;

  async function submit() {
    const priceTry = Number(price.replace(/\D/g, ''));
    const crewSize = Number(crew);
    if (!priceTry || priceTry < 500 || priceTry > 1_000_000) return setError('Fiyat 500 ile 1.000.000 TL arasında olmalı.');
    if (!vehicle) return setError('Aracı seç.');
    if (!Number.isInteger(crewSize) || crewSize < 1 || crewSize > 20) return setError('Ekip 1 ile 20 kişi arasında olmalı.');

    const body: QuoteInput = {
      priceTry,
      vehicleType: vehicle,
      crewSize,
      includesPacking: packing,
      includesAssembly: assembly,
      includesInsurance: insurance,
      message: message.trim(),
    };
    setError(null);
    setSaving(true);
    try {
      if (quote) await api.request(`/company/quotes/${quote.id}`, { method: 'PATCH', body });
      else await api.request(`/company/requests/${request.id}/quotes`, { method: 'POST', body });
      await onSaved(quote ? 'Teklifin güncellendi.' : 'Teklifin müşteriye gönderildi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Teklif kaydedilemedi, tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Field
        label="Toplam fiyat (TL, KDV dahil)"
        value={price}
        onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder="Örnek: 18500"
        maxLength={7}
      />
      <View style={{ gap: 6 }}>
        <AppText weight="medium">Araç</AppText>
        <Segmented options={VEHICLES} value={vehicle ?? ('' as VehicleType)} onChange={setVehicle} />
      </View>
      <Field
        label="Ekip (kişi)"
        value={crew}
        onChangeText={(t) => setCrew(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
      />
      <View style={{ gap: 2 }}>
        <AppText weight="medium">Fiyata dahil</AppText>
        <Checkbox label="Paketleme" hint={request.needsPacking ? '(müşteri istiyor)' : undefined} checked={packing} onChange={setPacking} />
        <Checkbox
          label="Mobilya söküm ve kurulumu"
          hint={request.needsAssembly ? '(müşteri istiyor)' : undefined}
          checked={assembly}
          onChange={setAssembly}
        />
        <Checkbox label="Taşıma sigortası" checked={insurance} onChange={setInsurance} />
      </View>
      <Field
        label="Müşteriye notun (isteğe bağlı)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        placeholder="Örnek: Asansörlü taşıma ve koli malzemesi fiyata dahildir."
        style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {charged ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
            borderColor: short ? colors.amber300 : colors.zinc200,
            backgroundColor: short ? colors.amber50 : colors.zinc50,
          }}
        >
          <AppText style={{ color: short ? colors.amber900 : colors.zinc600 }}>
            Bu teklif{' '}
            <AppText weight="bold" style={{ color: short ? colors.amber900 : colors.zinc900 }}>
              {formatCredits(credit.cost)}
            </AppText>
            . Bakiyen: {formatCredits(credit.balance)}.
            {short ? ' Bakiyen bu teklif için yetmiyor.' : ''}
          </AppText>
        </View>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button
        title={quote ? 'Teklifi güncelle' : charged ? `Teklifi gönder (${formatCredits(credit.cost)})` : 'Teklifi gönder'}
        loading={saving}
        disabled={short}
        onPress={() => void submit()}
      />
    </View>
  );
}
