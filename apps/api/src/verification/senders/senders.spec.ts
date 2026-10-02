import { ConfigService } from '@nestjs/config';
import { BrevoEmailCodeSender, renderCodeEmail } from './brevo-email.sender.js';
import { createEmailSender, createPhoneSender } from './index.js';
import { NetgsmSmsSender, smsText } from './netgsm-sms.sender.js';
import { WhatsAppCodeSender } from './whatsapp.sender.js';

const to = { address: '+905321234567', fullName: 'Ayşe Yılmaz' };

describe('doğrulama kodu sağlayıcıları', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('e-posta konusu kodu içerir (Gmail "Kodu kopyala"), HTML kaçışı yapılır', () => {
    const { subject, html, text } = renderCodeEmail('513001', '<Ayşe> Yılmaz', 'https://evdenevenakliyat.app');
    // Boşluksuz: seçip kopyalayınca hane kaybolmaz
    expect(subject).toBe('Doğrulama kodun: 513001');
    expect(html).toContain('>513001</p>');
    expect(html).toContain('href="https://evdenevenakliyat.app/dogrulama?kod=513001"');
    expect(html).toContain('&lt;Ayşe&gt;');
    expect(text).toContain('10 dakika');
  });

  it('Brevo isteği kodu konu ve gövdede taşır', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await new BrevoEmailCodeSender('gizli', new ConfigService({})).send({ ...to, address: 'ayse@ornek.com' }, '042917');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: 'ayse@ornek.com', name: 'Ayşe Yılmaz' }]);
    expect(body.subject).toBe('Doğrulama kodun: 042917');
    expect(body.tags).toEqual(['VERIFICATION_CODE']);
  });

  it('SMS metni ASCII ve WebOTP satırıyla biter', () => {
    const text = smsText('513001', 'evdenevenakliyat.app');
    expect(text).toMatch(/^[\x20-\x7e\n]+$/);
    expect(text.split('\n').at(-1)).toBe('@evdenevenakliyat.app #513001');
  });

  it('Netgsm OTP isteği: temel kimlik doğrulama, ülke kodu olmadan numara, "00" başarı', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"00","jobid":"123"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const sender = new NetgsmSmsSender({ userCode: '8500000000', password: 'sifre', header: 'EVDENEVE', domain: 'evdenevenakliyat.app' });
    await sender.send(to, '513001');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.netgsm.com.tr/sms/rest/v2/otp');
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('8500000000:sifre').toString('base64')}`);
    const body = JSON.parse(init.body);
    expect(body.msgheader).toBe('EVDENEVE');
    expect(body.messages[0].no).toBe('5321234567');
  });

  it('Netgsm hata kodunda hata fırlatır, şifreyi mesaja koymaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"30","description":"gecersiz kullanici"}', { status: 406 })));
    const sender = new NetgsmSmsSender({ userCode: 'u', password: 'sifre', header: 'H', domain: 'd' });
    const error = await sender.send(to, '513001').catch((e: Error) => e);
    expect((error as Error).message).toBe('Netgsm 30: gecersiz kullanici');
  });

  it('WhatsApp authentication şablonu kodu gövde ve kopyala düğmesinde gönderir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new WhatsAppCodeSender({ token: 't', phoneNumberId: '42', template: 'dogrulama_kodu', language: 'tr' }).send(to, '513001');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/42/messages');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('905321234567');
    expect(body.template.name).toBe('dogrulama_kodu');
    expect(body.template.components[0].parameters[0].text).toBe('513001');
    expect(body.template.components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: '0' });
  });

  it('sağlayıcı seçimi: anahtar yoksa telefon kapalı, canlıda log sağlayıcısı kullanılmaz', () => {
    expect(createPhoneSender(new ConfigService({}))).toBeNull();
    expect(createPhoneSender(new ConfigService({ PHONE_OTP_PROVIDER: 'netgsm' }))).toBeNull();
    expect(createPhoneSender(new ConfigService({ PHONE_OTP_PROVIDER: 'log', NODE_ENV: 'production' }))).toBeNull();
    expect(createPhoneSender(new ConfigService({ PHONE_OTP_PROVIDER: 'log' }))?.provider).toBe('log');
    expect(
      createPhoneSender(new ConfigService({ PHONE_OTP_PROVIDER: 'WhatsApp', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' }))?.provider,
    ).toBe('whatsapp');
    expect(createEmailSender(new ConfigService({ NODE_ENV: 'production' }))).toBeNull();
    expect(createEmailSender(new ConfigService({}))?.provider).toBe('log');
    expect(createEmailSender(new ConfigService({ BREVO_API_KEY: 'k' }))?.provider).toBe('brevo');
  });
});
