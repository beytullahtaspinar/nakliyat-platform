import Ionicons from '@expo/vector-icons/Ionicons';
import type { ContactVerification } from '@nakliyat/api-client';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { DetailScreen } from '@/components/panel';
import { AppText, Button, Field, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { colors } from '@/theme';

/** +905321234567 → 0532 *** ** 67 */
const maskPhone = (phone: string) => `0${phone.slice(3, 6)} *** ** ${phone.slice(-2)}`;

/** Sitedeki /dogrulama: e-posta kodu (SMS sağlayıcısı bağlıysa telefon kodu da). Doğrulanınca taslak talepler yayına girer. */
export default function VerificationScreen() {
  const { reload: reloadSession } = useSession();
  const { data, error, reload } = useApi<ContactVerification>('/auth/verification');
  const [status, setStatus] = useState<ContactVerification | null>(null);
  const current = status ?? data;

  // Sunucunun döndürdüğü son durum ekranda kalır; tamamlanınca oturumdaki kullanıcı da güncellenir
  async function apply(next: ContactVerification) {
    setStatus(next);
    if (next.complete) await reloadSession();
  }

  return (
    <DetailScreen backLabel="Geri" onRefresh={() => reload().then(() => setStatus(null))}>
      <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28 }}>
        Hesabını doğrula
      </AppText>
      {error ? <Notice>{error}</Notice> : null}
      {!current ? null : current.complete ? (
        <View style={{ gap: 12 }}>
          <Notice tone="info">Hesabın doğrulandı. Taslak taleplerin firmalara iletildi, teklifleri kabul edebilirsin.</Notice>
          <Button title="Taleplerime dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      ) : (
        <>
          <AppText style={{ color: colors.zinc600 }}>
            Talebinin firmalara iletilmesi ve teklif kabul edebilmen için iletişim bilgilerini doğrula. Bir kez yapman yeterli.
          </AppText>
          <Step number={1} title="E-posta adresi" done={current.emailVerified} doneText={`${current.email} doğrulandı`}>
            <EmailStep status={current} onStatus={apply} />
          </Step>
          {current.phoneRequired ? (
            <Step number={2} title="Cep telefonu" done={current.phoneVerified} doneText={`${maskPhone(current.phone)} doğrulandı`}>
              <PhoneStep status={current} onStatus={apply} />
            </Step>
          ) : null}
        </>
      )}
    </DetailScreen>
  );
}

function Step({ number, title, done, doneText, children }: { number: number; title: string; done: boolean; doneText: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.zinc200, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? colors.brand700 : colors.brand50,
          }}
        >
          {done ? (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          ) : (
            <AppText weight="bold" style={{ color: colors.brand700, fontSize: 14 }}>
              {number}
            </AppText>
          )}
        </View>
        <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>
          {title}
        </AppText>
      </View>
      {done ? <AppText style={{ color: colors.green700 }}>{doneText}</AppText> : children}
    </View>
  );
}

type StepProps = { status: ContactVerification; onStatus: (s: ContactVerification) => Promise<void> };

function useAction(onStatus: StepProps['onStatus']) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(path: string, body: object, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onStatus(await api.request<ContactVerification>(`/auth/verification/${path}`, { method: 'POST', body }));
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı, tekrar dene.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const messages = (
    <>
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}
    </>
  );
  return { busy, run, messages };
}

function EmailStep({ status, onStatus }: StepProps) {
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState(status.email ?? '');
  const send = useAction(onStatus);
  const sentTo = status.emailCodeSentTo;

  if (!sentTo || changing) {
    return (
      <View style={{ gap: 10 }}>
        <Field
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={191}
        />
        {send.messages}
        <Button
          title="Kod gönder"
          loading={send.busy}
          onPress={() =>
            void send
              .run('email/send', email.trim() && email.trim() !== status.email ? { email: email.trim() } : {}, 'Kod gönderildi.')
              .then((ok) => ok && setChanging(false))
          }
        />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <AppText>
        <AppText weight="semibold">{sentTo}</AppText> adresine 6 haneli bir kod gönderdik. Gelen kutunu ve spam klasörünü kontrol et.
      </AppText>
      <CodeForm path="email/confirm" onStatus={onStatus} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <ResendButton path="email/send" resendAt={status.emailResendAt} onStatus={onStatus} />
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            setEmail('');
            setChanging(true);
          }}
        >
          <AppText weight="semibold" style={{ color: colors.brand700 }}>
            Adresi değiştir
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function PhoneStep({ status, onStatus }: StepProps) {
  const send = useAction(onStatus);
  const channel = status.phoneChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
  if (!status.phoneCodeSent) {
    return (
      <View style={{ gap: 10 }}>
        <AppText>
          <AppText weight="semibold">{maskPhone(status.phone)}</AppText> numarana {channel} ile bir kod göndereceğiz.
        </AppText>
        {send.messages}
        <Button title={`${channel} ile kod gönder`} loading={send.busy} onPress={() => void send.run('phone/send', {})} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <AppText>
        <AppText weight="semibold">{maskPhone(status.phone)}</AppText> numarana {channel} ile 6 haneli bir kod gönderdik.
      </AppText>
      <CodeForm path="phone/confirm" onStatus={onStatus} />
      <ResendButton path="phone/send" resendAt={status.phoneResendAt} onStatus={onStatus} />
    </View>
  );
}

/** 6 hane girilince kendiliğinden gönderilir */
function CodeForm({ path, onStatus }: { path: string; onStatus: StepProps['onStatus'] }) {
  const [code, setCode] = useState('');
  const confirm = useAction(onStatus);

  function change(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void confirm.run(path, { code: digits });
  }

  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Doğrulama kodu"
        value={code}
        onChangeText={change}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        editable={!confirm.busy}
        style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
      />
      {confirm.messages}
      <Button title="Doğrula" loading={confirm.busy} disabled={code.length !== 6} onPress={() => void confirm.run(path, { code })} />
    </View>
  );
}

function ResendButton({ path, resendAt, onStatus }: { path: string; resendAt: string | null; onStatus: StepProps['onStatus'] }) {
  const send = useAction(onStatus);
  const [now, setNow] = useState(Date.now());
  const wait = resendAt ? Math.max(0, Math.ceil((Date.parse(resendAt) - now) / 1000)) : 0;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" hitSlop={8} disabled={send.busy || wait > 0} onPress={() => void send.run(path, {}, 'Yeni kod gönderildi.')}>
        <AppText weight="semibold" style={{ color: wait > 0 || send.busy ? colors.zinc500 : colors.brand700 }}>
          {wait > 0 ? `Yeni kod (${wait} sn)` : send.busy ? 'Gönderiliyor…' : 'Yeni kod gönder'}
        </AppText>
      </Pressable>
      {send.messages}
    </View>
  );
}
