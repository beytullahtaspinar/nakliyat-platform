import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../generated/prisma/enums.js';
import { templates } from '../templates.js';
import { BrevoEmailChannel } from './brevo-email.channel.js';
import { renderEmail } from './email-layout.js';

const recipient = { userId: 'u1', role: UserRole.CUSTOMER, fullName: 'Ayşe Yılmaz', email: 'ayse@ornek.com', phone: '+905321234567' };
const content = templates.newQuote({
  from: 'İstanbul, Kadıköy',
  to: 'Ankara, Çankaya',
  moveDate: new Date('2026-10-20T00:00:00Z'),
  requestId: 'req1',
  companyName: '<Hızlı> & Güvenli',
  priceTry: '18500',
});
const channel = (env: Record<string, string>) => new BrevoEmailChannel(new ConfigService(env));

describe('renderEmail', () => {
  it('bağlantıları WEB_URL ile kurar ve HTML kaçışı yapar', () => {
    const { subject, html, text } = renderEmail(content, {
      recipientName: 'Ayşe Yılmaz',
      webUrl: 'https://evdenevenakliyat.app',
      settingsPath: '/hesabim/bildirimler',
    });
    expect(subject).toBe('<Hızlı> & Güvenli teklif verdi: ₺18.500');
    expect(html).toContain('&lt;Hızlı&gt; &amp; Güvenli');
    expect(html).not.toContain('<Hızlı>');
    expect(html).toContain('href="https://evdenevenakliyat.app/hesabim/talepler/req1"');
    expect(html).toContain('Merhaba Ayşe,');
    expect(text).toContain('Teklifleri karşılaştır: https://evdenevenakliyat.app/hesabim/talepler/req1');
    expect(text).toContain('Bildirim ayarları: https://evdenevenakliyat.app/hesabim/bildirimler');
  });
});

describe('BrevoEmailChannel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('API anahtarı yoksa göndermez', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(channel({}).send(recipient, content)).resolves.toEqual({ status: 'SKIPPED', reason: 'BREVO_API_KEY tanımlı değil' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('alıcının e-postası yoksa göndermez', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await channel({ BREVO_API_KEY: 'k' }).send({ ...recipient, email: null }, content);
    expect(result.status).toBe('SKIPPED');
  });

  it('Brevo API isteğini doğru kurar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"messageId":"x"}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await channel({ BREVO_API_KEY: 'gizli', MAIL_FROM_EMAIL: 'bildirim@evdenevenakliyat.app', WEB_URL: 'https://evdenevenakliyat.app' }).send(recipient, content);
    expect(result).toEqual({ status: 'SENT' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('gizli');
    const body = JSON.parse(init.body);
    expect(body.sender.email).toBe('bildirim@evdenevenakliyat.app');
    expect(body.to).toEqual([{ email: 'ayse@ornek.com', name: 'Ayşe Yılmaz' }]);
    expect(body.tags).toEqual(['NEW_QUOTE']);
    expect(body.htmlContent).toContain('https://evdenevenakliyat.app/hesabim/bildirimler');
  });

  it('hata yanıtında yeniden denenmek üzere hata fırlatır, anahtarı mesaja koymaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"unauthorized"}', { status: 401 })));
    const error = await channel({ BREVO_API_KEY: 'gizli' }).send(recipient, content).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Brevo 401: {"code":"unauthorized"}');
    expect((error as Error).message).not.toContain('gizli');
  });
});
