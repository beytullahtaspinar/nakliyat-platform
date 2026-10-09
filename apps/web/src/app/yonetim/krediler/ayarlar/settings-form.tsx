"use client";

import { FormError } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { updateCreditSettings } from "@/lib/actions/admin";
import { CREDIT_SETTING_FIELDS, MAX_BANK_ACCOUNTS, formatIban, type CreditSettings } from "@/lib/credits";

const cardClass = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20";

export function CreditSettingsForm({
  settings,
  defaults,
  iyzico,
}: {
  settings: CreditSettings;
  defaults: CreditSettings;
  iyzico: { configured: boolean; sandbox: boolean };
}) {
  const { state, pending, formProps } = useFormAction(updateCreditSettings, {});
  return (
    <form {...formProps} className="max-w-3xl space-y-5">
      <div className={cardClass}>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1 h-5 w-5 accent-brand-700" />
          <span>
            <span className="block text-base font-semibold text-slate-900">Kredi sistemi açık</span>
            <span className="block text-sm text-slate-600">
              Açıkken firmalar teklif gönderirken kredi düşer, bakiyesi yetmeyen teklif veremez. Kapalıyken teklif vermek ücretsizdir.
            </span>
          </span>
        </label>
      </div>

      <div className={cardClass}>
        <h2 className="text-base font-semibold text-slate-900">Değerler</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CREDIT_SETTING_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-slate-800">
                {f.label} <span className="font-normal text-slate-500">({f.unit})</span>
              </span>
              <input name={f.key} inputMode={f.decimal ? "decimal" : "numeric"} required defaultValue={String(settings[f.key])} className={input} />
              <span className="mt-1 block text-xs text-slate-500">
                {f.hint}. Varsayılan: {defaults[f.key].toLocaleString("tr-TR")}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Teklifi geri çeken firmaya iade yapılmaz. Müşteri talebi iptal ederse teklif veren firmalara kredi tamamen iade edilir.
        </p>
      </div>

      <div id="kart" className={`${cardClass} scroll-mt-20`}>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="cardEnabled" defaultChecked={settings.cardEnabled} className="mt-1 h-5 w-5 accent-brand-700" />
          <span>
            <span className="block text-base font-semibold text-slate-900">Kartla ödeme açık (iyzico)</span>
            <span className="block text-sm text-slate-600">
              Firmalar kredi sayfasında kartla öder; ödeme onaylanınca kredi hemen yüklenir. Kart bilgisi sunucumuza gelmez.
            </span>
          </span>
        </label>
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${iyzico.configured && !iyzico.sandbox ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}
        >
          {!iyzico.configured
            ? "iyzico anahtarları sunucuda tanımlı değil. Açsan da firmalar kart seçeneğini görmez (kurulum: docs/kredi.md)."
            : iyzico.sandbox
              ? "Deneme ortamı (sandbox) anahtarları tanımlı: alınan ödemeler gerçek para değildir. Yalnızca kendi deneme firmanla dene, sonra kapat."
              : "Canlı iyzico anahtarları tanımlı."}
        </p>
      </div>

      <fieldset id="banka-hesaplari" className={`${cardClass} scroll-mt-20`}>
        <legend className="sr-only">Havale/EFT hesapları</legend>
        <h2 className="text-base font-semibold text-slate-900" aria-hidden="true">
          Havale/EFT hesapları
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Firmalar kredi yüklemek için bu hesaplara havale yapar ve bildirir. Hiç hesap yoksa havale bildirimi kapalıdır. Hesabı
          kaldırmak için üç alanını da boşalt.
        </p>
        <div className="mt-4 space-y-4">
          {Array.from({ length: MAX_BANK_ACCOUNTS }, (_, i) => {
            const a = settings.bankAccounts[i];
            return (
              <div key={i} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="text-sm font-medium text-slate-800">{i + 1}. hesap: banka</span>
                  <input name={`bank_${i}`} defaultValue={a?.bank ?? ""} maxLength={80} className={input} />
                </label>
                <label className="block min-w-0">
                  <span className="text-sm font-medium text-slate-800">Hesap sahibi</span>
                  <input name={`holder_${i}`} defaultValue={a?.holder ?? ""} maxLength={120} className={input} />
                </label>
                <label className="block min-w-0 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-800">IBAN</span>
                  <input
                    name={`iban_${i}`}
                    defaultValue={a ? formatIban(a.iban) : ""}
                    maxLength={40}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    className={`${input} font-mono`}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3">
        <FormError message={state.error} />
        {state.notice && (
          <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            {state.notice}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
