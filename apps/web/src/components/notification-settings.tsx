"use client";

import { Checkbox, Field, FormError, Input, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { saveNotificationPreferences } from "@/lib/actions/notifications";
import type { NotificationChannel, NotificationPreferences } from "@/lib/api";

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "E-posta",
  SMS: "SMS",
  PUSH: "Uygulama bildirimi",
};

export function NotificationSettings({
  preferences,
  settingsPath,
}: {
  preferences: NotificationPreferences;
  settingsPath: string;
}) {
  const { state, pending, formProps } = useFormAction(saveNotificationPreferences.bind(null, settingsPath), {});
  const multiChannel = preferences.channels.length > 1;

  return (
    <form {...formProps} className="space-y-6">
      <Field
        label="Bildirim e-postası"
        hint="Bildirimler bu adrese gider. Boş bırakırsan yalnızca hesabındaki bildirimleri görürsün."
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={preferences.email ?? ""}
          placeholder="ornek@eposta.com"
          maxLength={191}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Hangi durumlarda haber verelim?</legend>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {preferences.items.map((item) => (
            <li key={item.type} className="p-4">
              <p className="font-medium text-zinc-900">{item.label}</p>
              <p className="mt-0.5 text-sm text-zinc-600">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {preferences.channels.map((channel) => {
                  const key = `${item.type}:${channel}`;
                  return (
                    <span key={key}>
                      <input type="hidden" name="pref" value={key} />
                      <Checkbox
                        name={`pref:${key}`}
                        defaultChecked={item.channels[channel] ?? true}
                        label={multiChannel ? CHANNEL_LABELS[channel] : `${CHANNEL_LABELS[channel]} ile bildir`}
                      />
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Kapattığın bildirimleri de hesabına girdiğinde görmeye devam edersin.
        </p>
      </fieldset>

      <FormError message={state.error} />
      {state.saved && !pending && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Bildirim ayarların kaydedildi.
        </p>
      )}
      <SubmitButton pending={pending}>Kaydet</SubmitButton>
    </form>
  );
}
