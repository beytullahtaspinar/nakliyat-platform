"use client";

import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/credits/copy-button";
import { sendOnboardingReminder } from "@/lib/actions/admin";
import { formatDateTime } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

/** Yöneticinin kopyalayıp WhatsApp ya da SMS ile ileteceği hazır mesaj */
export function onboardingMessage(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  return [
    `Merhaba ${firstName}, evdenevenakliyat.app'e firma olarak kaydolduğunuz için teşekkür ederiz.`,
    "Taleplere teklif verebilmeniz için firma bilgilerinizi girmeniz, K3 yetki belgesi, vergi levhası ve ticaret sicil belgenizi, aracınızın ruhsatıyla plakası görünen fotoğraflarını yüklemeniz gerekiyor. Ekibimiz kontrol edip firmanızı onaylıyor.",
    `${SITE_URL}/firma-paneli adresinden giriş yapıp kaldığınız yerden devam edebilirsiniz. Takıldığınız bir yer olursa bu mesaja yazmanız yeterli.`,
  ].join("\n\n");
}

/** Firma bilgilerini girmemiş firma hesabı: durum, hatırlatma gönderme ve hazır mesaj */
export function OnboardingCard({
  userId,
  fullName,
  phone,
  reminderStep,
  remindedAt,
}: {
  userId: string;
  fullName: string;
  phone: string;
  reminderStep: number;
  remindedAt: string | null;
}) {
  const [state, setState] = useState<{ error?: string; notice?: string }>({});
  const [pending, startTransition] = useTransition();
  const message = onboardingMessage(fullName);
  const whatsapp = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  const auto = reminderStep === 0 ? "Henüz otomatik hatırlatma gitmedi." : `${reminderStep} otomatik hatırlatma gitti.`;

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/60 p-5">
      <h2 className="font-semibold text-amber-950">Kaydı yarım kaldı: firma bilgisi yok</h2>
      <p className="mt-1 text-sm text-amber-950/80">
        Firma olarak kayıt oldu ama firma bilgilerini girmedi, bu yüzden belge ve araç da yükleyemedi. Kayıttan 1 ve 3
        gün sonra otomatik hatırlatma gider. {auto}
        {remindedAt ? ` Son hatırlatma: ${formatDateTime(remindedAt)}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await sendOnboardingReminder(userId)))}
        >
          {pending ? "Gönderiliyor…" : "Hatırlatma gönder"}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          WhatsApp ile yaz
        </a>
      </div>
      <FormError message={state.error} />
      {state.notice && (
        <p role="status" className="mt-2 text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Hazır mesaj</h3>
          <CopyButton value={message} label="Hazır mesajı" />
        </div>
        <p className="mt-2 whitespace-pre-line rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p>
      </div>
    </Card>
  );
}
