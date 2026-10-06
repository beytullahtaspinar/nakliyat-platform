"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CodeInput, toCode, useSecondsUntil } from "@/components/forms/code-input";
import { Field, FormError, Input } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { verificationStep, type VerificationFormState } from "@/lib/actions/verification";
import type { ContactVerification } from "@/lib/api";

/** +905321234567 → 0532 *** ** 67 */
const maskPhone = (phone: string) => `0${phone.slice(3, 6)} *** ** ${phone.slice(-2)}`;

export function VerificationSteps({ status, next }: { status: ContactVerification; next: string }) {
  const phoneLabel = status.phoneChannel === "whatsapp" ? "WhatsApp" : "SMS";
  return (
    <div className="mt-6 space-y-4">
      <Step
        number={1}
        title="E-posta adresi"
        done={status.emailVerified}
        doneText={`${status.email} doğrulandı`}
      >
        <EmailStep status={status} next={next} />
      </Step>
      {status.phoneRequired && (
        <Step
          number={2}
          title="Cep telefonu"
          done={status.phoneVerified}
          doneText={`${maskPhone(status.phone)} doğrulandı`}
        >
          <PhoneStep status={status} next={next} channelLabel={phoneLabel} />
        </Step>
      )}
    </div>
  );
}

function Step({
  number,
  title,
  done,
  doneText,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  doneText: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-3 font-semibold">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
            done ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800"
          }`}
        >
          {done ? "✓" : number}
        </span>
        {title}
      </h2>
      {done ? <p className="mt-2 text-sm text-brand-800">{doneText}</p> : <div className="mt-4">{children}</div>}
    </Card>
  );
}

function EmailStep({ status, next }: { status: ContactVerification; next: string }) {
  const [changing, setChanging] = useState(false);
  const sentTo = status.emailCodeSentTo;
  if (!sentTo || changing) {
    return <SendForm intent="email-send" email={changing ? "" : (status.email ?? "")} onSent={() => setChanging(false)} />;
  }
  return (
    <>
      <p className="text-sm text-zinc-700">
        <strong>{sentTo}</strong> adresine 6 haneli bir kod gönderdik. Gelen kutunu ve spam klasörünü kontrol et.
      </p>
      <CodeForm intent="email-confirm" next={next} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ResendForm intent="email-send" resendAt={status.emailResendAt} />
        <button type="button" onClick={() => setChanging(true)} className="text-sm font-medium text-brand-700 hover:underline">
          Adresi değiştir
        </button>
      </div>
    </>
  );
}

function PhoneStep({ status, next, channelLabel }: { status: ContactVerification; next: string; channelLabel: string }) {
  if (!status.phoneCodeSent) {
    return (
      <>
        <p className="text-sm text-zinc-700">
          <strong>{maskPhone(status.phone)}</strong> numarana {channelLabel} ile bir kod göndereceğiz.
        </p>
        <SendForm intent="phone-send" label={`${channelLabel} ile kod gönder`} />
      </>
    );
  }
  return (
    <>
      <p className="text-sm text-zinc-700">
        <strong>{maskPhone(status.phone)}</strong> numarana {channelLabel} ile 6 haneli bir kod gönderdik.
      </p>
      <CodeForm intent="phone-confirm" next={next} listenSms={status.phoneChannel === "sms"} />
      <div className="mt-3">
        <ResendForm intent="phone-send" resendAt={status.phoneResendAt} />
      </div>
    </>
  );
}

function useStep() {
  return useFormAction<VerificationFormState>(verificationStep, {});
}

function Notice({ state }: { state: VerificationFormState }) {
  if (state.error) return <FormError message={state.error} />;
  if (!state.notice) return null;
  return (
    <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
      {state.notice}
    </p>
  );
}

function SendForm({
  intent,
  email,
  label = "Kod gönder",
  onSent,
}: {
  intent: "email-send" | "phone-send";
  email?: string;
  label?: string;
  onSent?: () => void;
}) {
  const { state, pending, formProps } = useStep();
  useEffect(() => {
    if (state.notice) onSent?.();
  }, [state, onSent]);
  return (
    <form {...formProps} className="mt-3 space-y-3">
      <input type="hidden" name="intent" value={intent} />
      {intent === "email-send" && (
        <Field label="E-posta">
          <Input name="email" type="email" autoComplete="email" defaultValue={email} maxLength={191} required />
        </Field>
      )}
      <Notice state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gönderiliyor…" : label}
      </Button>
    </form>
  );
}

/** 6 hane girilince form kendiliğinden gönderilir. */
function CodeForm({
  intent,
  next,
  listenSms,
}: {
  intent: "email-confirm" | "phone-confirm";
  next: string;
  listenSms?: boolean;
}) {
  const { state, pending, formProps } = useStep();
  const formRef = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");

  // 6 hane tamamlanınca kendiliğinden gönder. Efektte: yapıştır düğmesi ve WebOTP kodu async
  // yazdığında değer alana işlenmeden gönderilip boş kod doğrulamaya takılıyordu.
  useEffect(() => {
    if (code.length === 6) formRef.current?.requestSubmit();
  }, [code]);

  // Android Chrome: SMS'teki "@alan-adı #kod" satırını okuyup alanı kendisi doldurur (WebOTP)
  useEffect(() => {
    if (!listenSms || !("OTPCredential" in window)) return;
    const abort = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions)
      .then((otp) => {
        const value = (otp as { code?: string } | null)?.code;
        if (value) setCode(toCode(value));
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [listenSms]);

  return (
    <form {...formProps} ref={formRef} className="mt-4 space-y-3">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="next" value={next} />
      <CodeInput value={code} onChange={setCode} disabled={pending} />
      <Notice state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Kontrol ediliyor…" : "Doğrula"}
      </Button>
    </form>
  );
}

function ResendForm({ intent, resendAt }: { intent: "email-send" | "phone-send"; resendAt: string | null }) {
  const { state, pending, formProps } = useStep();
  const wait = useSecondsUntil(resendAt);
  return (
    <form {...formProps} className="space-y-2">
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        disabled={pending || wait > 0}
        suppressHydrationWarning
        className="text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline"
      >
        {wait > 0 ? `Yeni kod (${wait} sn)` : pending ? "Gönderiliyor…" : "Yeni kod gönder"}
      </button>
      <Notice state={state} />
    </form>
  );
}
