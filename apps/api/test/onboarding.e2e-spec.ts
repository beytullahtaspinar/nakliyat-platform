import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { OnboardingRemindersService } from './../src/companies/onboarding-reminders.service.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './../src/notifications/channels/channel.js';
import type { NotificationContent } from './../src/notifications/templates.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, addApprovedVehicles, retryOnConflict } from './helpers.js';

class FakeEmail implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  sent: { to: string | null; content: NotificationContent }[] = [];
  async send(recipient: Recipient, content: NotificationContent) {
    if (!recipient.email) return { status: 'SKIPPED' as const, reason: 'e-posta yok' };
    this.sent.push({ to: recipient.email, content });
    return { status: 'SENT' as const };
  }
}

// Firma olarak kayıt olup firma bilgilerini girmeyen hesaplar. Çalışan bir MariaDB/MySQL gerektirir.
describe('Kaydı yarım firmalar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = { idle: '+905320009401', done: '+905320009402', admin: '+905320009403', partial: '+905320009404' };
  const emails = { idle: 'yarim-firma@test.local', done: 'tamam-firma@test.local', partial: 'eksik-firma@test.local' };
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const companyIds: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const mails = (address: string) => email.sent.filter((m) => m.to === address).map((m) => m.content);
  // Bugün TSİ öğlen: gönderim saatleri içinde
  const noon = new Date(`${new Date().toISOString().slice(0, 10)}T09:00:00Z`);
  const daysBeforeNoon = (days: number) => new Date(noon.getTime() - days * 86_400_000 - 60_000);
  /** Hesabı, firmayı, belgeleri ve araçları `days` gün öncesine çeker (son ilerleme o gün olur) */
  const ageBy = async (who: 'idle' | 'done' | 'partial', days: number) => {
    const createdAt = daysBeforeNoon(days);
    await prisma.user.update({ where: { id: ids[who] }, data: { createdAt } });
    const company = await prisma.company.findUnique({ where: { ownerId: ids[who] }, select: { id: true } });
    if (!company) return;
    await prisma.company.update({ where: { id: company.id }, data: { createdAt } });
    await prisma.companyDocument.updateMany({ where: { companyId: company.id }, data: { createdAt } });
    await prisma.vehicle.updateMany({ where: { companyId: company.id }, data: { createdAt } });
  };
  const createProfile = (who: 'done' | 'partial', taxNumber: string) =>
    http()
      .post('/v1/company/profile')
      .set(auth(who))
      .send({ legalName: `${who} Nakliyat Ltd.`, displayName: `${who} Nakliyat`, taxNumber, cityCode: '16', serviceCityCodes: ['16'] })
      .expect(201)
      .then((r) => r.body.id as string);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_CHANNELS)
      .useValue([email])
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await retryOnConflict(cleanup);

    for (const who of ['idle', 'done', 'partial'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: 'COMPANY', fullName: `Yarım ${who}`, phone: phones[who], email: emails[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
      ids[who] = res.body.user.id;
    }
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await events.drain();
    await retryOnConflict(cleanup);
    await app.close();
  });

  it('firma kaydında hoş geldin bildirimi kalan adımları anlatır', async () => {
    await events.drain();
    const [welcome] = mails(emails.idle);
    expect(welcome).toMatchObject({ type: 'COMPANY_ONBOARDING', title: 'Hoş geldin! Firma kaydını tamamla', path: '/firma-paneli' });
    expect(welcome.details?.[1]).toContain('K3 yetki belgesi');
  });

  it('yönetim listesinde ve panoda kaydı yarım firmalar eksikleriyle görünür', async () => {
    // Tamamlanmış: tüm zorunlu belgeler ve araç yüklü
    companyIds.done = await createProfile('done', '7777779402');
    await addApprovedDocuments(prisma, [companyIds.done]);
    // Yarım: firma bilgisi var, yalnızca vergi levhası yüklenmiş ve onaylanmış
    companyIds.partial = await createProfile('partial', '7777779404');
    await prisma.companyDocument.create({
      data: {
        companyId: companyIds.partial,
        type: 'TAX_CERTIFICATE',
        storageKey: `firmalar/${companyIds.partial}/vergi-${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        fileName: 'vergi.pdf',
        status: 'VERIFIED',
      },
    });

    const list = await http().get('/v1/admin/users?profile=missing&q=Yar%C4%B1m&limit=50').set(auth('admin')).expect(200);
    const byId = Object.fromEntries(list.body.items.map((u: { id: string }) => [u.id, u]));
    expect(byId[ids.done]).toBeUndefined();
    expect(byId[ids.idle]).toMatchObject({ company: null, onboardingMissing: ['Firma bilgileri'], onboardingReminderStep: 0 });
    expect(byId[ids.partial].onboardingMissing).toEqual([
      'K3 yetki belgesi',
      'Ticaret sicil gazetesi / faaliyet belgesi',
      'Araç (ruhsat ve plakalı fotoğraflar)',
    ]);

    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.users.missingCompanyProfile).toBeGreaterThanOrEqual(1);
  });

  it('1. ve 3. günde birer otomatik hatırlatma gider, eksiği olmayana gitmez', async () => {
    const reminders = app.get(OnboardingRemindersService);
    await ageBy('idle', 1);
    await ageBy('done', 1);
    await ageBy('partial', 1);
    email.sent.length = 0;

    // Gece hiç gönderilmez
    expect(await reminders.sendDue(new Date(noon.getTime() - 4 * 3_600_000))).toBe(0);

    await reminders.sendDue(noon);
    await reminders.sendDue(noon); // aynı adım ikinci kez gitmez
    await events.drain();
    expect(mails(emails.idle).map((m) => m.title)).toEqual(['Firma kaydın yarım kaldı']);
    expect(mails(emails.done)).toEqual([]);
    const [partial] = mails(emails.partial);
    expect(partial).toMatchObject({ title: 'Firma kaydında eksikler var', path: '/firma-paneli/belgeler', actionLabel: 'Belgelerimi yükle' });
    expect(partial.details).toContain('Eksik: K3 yetki belgesi');
    expect(partial.details).not.toContain('Eksik: Vergi levhası');

    // İki gün geçti: önceki hatırlatma artık yakın sayılmaz
    await ageBy('idle', 3);
    await prisma.user.update({ where: { id: ids.idle }, data: { onboardingRemindedAt: new Date(noon.getTime() - 2 * 86_400_000) } });
    await reminders.sendDue(noon);
    await events.drain();
    expect(mails(emails.idle).map((m) => m.title)).toEqual(['Firma kaydın yarım kaldı', 'Talepler seni bekliyor']);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.idle } });
    expect(user.onboardingReminderStep).toBe(2);
  });

  it('firma yeni belge yükleyince hatırlatmalar o günden yeniden sayılır, eksik kalmayınca durur', async () => {
    const reminders = app.get(OnboardingRemindersService);
    // Yarım firma 2 gün önce K3 ve ticaret sicilini yükledi (1. hatırlatma ondan önce gitmişti)
    await prisma.user.update({ where: { id: ids.partial }, data: { onboardingRemindedAt: daysBeforeNoon(3) } });
    for (const type of ['K3_LICENSE', 'TRADE_REGISTRY'] as const) {
      await prisma.companyDocument.create({
        data: {
          companyId: companyIds.partial,
          type,
          storageKey: `firmalar/${companyIds.partial}/${type}-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          fileName: `${type}.pdf`,
          validUntil: type === 'K3_LICENSE' ? new Date(Date.now() + 365 * 86_400_000) : null,
          createdAt: daysBeforeNoon(2),
        },
      });
    }
    email.sent.length = 0;
    await reminders.sendDue(noon);
    await events.drain();
    const [again] = mails(emails.partial);
    expect(again).toMatchObject({ title: 'Firma kaydında eksikler var', path: '/firma-paneli/araclar', actionLabel: 'Aracımı ekle' });
    expect(again.details?.[0]).toBe('Eksik: Araç (ruhsat ve plakalı fotoğraflar)');

    // Araç da yüklendi (incelemede): firmanın yapacağı bir şey kalmadı
    await addApprovedVehicles(prisma, [companyIds.partial]);
    await prisma.vehicle.updateMany({ where: { companyId: companyIds.partial }, data: { status: 'PENDING', createdAt: daysBeforeNoon(4) } });
    await prisma.user.update({ where: { id: ids.partial }, data: { onboardingRemindedAt: daysBeforeNoon(5) } });
    email.sent.length = 0;
    await reminders.sendDue(noon);
    await events.drain();
    expect(mails(emails.partial)).toEqual([]);
    const list = await http().get('/v1/admin/users?profile=missing&q=Yar%C4%B1m&limit=50').set(auth('admin')).expect(200);
    const listed = list.body.items.map((u: { id: string }) => u.id);
    expect(listed).toContain(ids.idle);
    expect(listed).not.toContain(ids.partial);
  });

  it('yönetici elle hatırlatma gönderir; 12 saat içinde ikincisi reddedilir', async () => {
    await prisma.user.update({ where: { id: ids.idle }, data: { onboardingRemindedAt: new Date(Date.now() - 13 * 3_600_000) } });
    email.sent.length = 0;

    const res = await http().post(`/v1/admin/users/${ids.idle}/onboarding-reminder`).set(auth('admin')).expect(200);
    expect(res.body.history[0].action).toBe('user.onboarding_reminder');
    await events.drain();
    expect(mails(emails.idle).map((m) => m.title)).toEqual(['Firma kaydını tamamlaman bekleniyor']);

    await http().post(`/v1/admin/users/${ids.idle}/onboarding-reminder`).set(auth('admin')).expect(409);
    // Eksiği olmayan firmaya gönderilmez
    await http().post(`/v1/admin/users/${ids.done}/onboarding-reminder`).set(auth('admin')).expect(400);
  });

  it('firma panelinde zorunlu belge sayısı adım rehberi için döner', async () => {
    const res = await http().get('/v1/company/overview').set(auth('done')).expect(200);
    expect(res.body.documents).toEqual({ requiredUploaded: 3, requiredTotal: 3 });
  });
});
