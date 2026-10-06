import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { NOTIFICATION_CHANNELS, type ChannelProvider, type Recipient } from './../src/notifications/channels/channel.js';
import type { NotificationContent } from './../src/notifications/templates.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

class FakeEmail implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  sent: { to: string | null; content: NotificationContent }[] = [];
  async send(recipient: Recipient, content: NotificationContent) {
    this.sent.push({ to: recipient.email, content });
    return { status: 'SENT' as const };
  }
}

// İşin tamamlanması, müşteri değerlendirmesi, firma yanıtı, yönetici gizlemesi ve herkese açık firma sayfası.
// Çalışan bir MariaDB/MySQL gerektirir.
describe('Değerlendirmeler (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const email = new FakeEmail();
  const phones = {
    customer: '+905320000901',
    company: '+905320000902',
    other: '+905320000903',
    otherCompany: '+905320000904',
    admin: '+905320000905',
  };
  const emails = { customer: 'musteri-yorum@test.local', company: 'firma-yorum@test.local' };
  const tokens: Record<string, string> = {};
  let companyId: string;
  let otherCompanyId: string;
  let requestId: string;
  let bookingId: string;
  let reviewId: string;
  /** Silinen hesabın telefonu değiştiği için temizlikte kimlikle bulunur */
  const deletedIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const mails = (address: string, type: string) => email.sent.filter((m) => m.to === address && m.content.type === type);

  const cleanup = async () => {
    const users = { OR: [{ phone: { in: Object.values(phones) } }, { id: { in: deletedIds } }] };
    await prisma.review.deleteMany({ where: { customer: users } });
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
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
    await cleanup();

    const names = { customer: 'Ayşe Yorumcu', company: 'Firma Yetkilisi', other: 'Başka Müşteri', otherCompany: 'Başka Firma' };
    for (const who of ['customer', 'company', 'other', 'otherCompany'] as const) {
      const role = who === 'company' || who === 'otherCompany' ? 'COMPANY' : 'CUSTOMER';
      const res = await http()
        .post('/v1/auth/register')
        .send({ role, fullName: names[who], phone: phones[who], password: 'GucluSifre123', ...(who in emails && { email: emails[who as keyof typeof emails] }) })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const profile = await http()
      .post('/v1/company/profile')
      .set(auth('company'))
      .send({ legalName: 'Yorum Nakliyat Ltd.', displayName: 'Puanlı Test Nakliyat', taxNumber: '7777777501', cityCode: '35', serviceCityCodes: ['35', '06'], description: 'İzmir merkezli taşımacılık.' })
      .expect(201);
    companyId = profile.body.id;
    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
    otherCompanyId = (
      await http()
        .post('/v1/company/profile')
        .set(auth('otherCompany'))
        .send({ legalName: 'Onaysız Nakliyat Ltd.', displayName: 'Onaysız Nakliyat', taxNumber: '7777777502', cityCode: '35', serviceCityCodes: ['35'] })
        .expect(201)
    ).body.id;

    const req = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '35', fromDistrict: 'karsiyaka', fromAddress: 'Yorum Sok. No:1', fromFloor: 1, fromHasElevator: false,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Puan Sok. No:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(10),
      })
      .expect(201);
    requestId = req.body.id;
    const quote = await http()
      .post(`/v1/company/requests/${requestId}/quotes`)
      .set(auth('company'))
      .send({ priceTry: 18000, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(201);
    const accepted = await http().post(`/v1/quotes/${quote.body.id}/accept`).set(auth('customer')).expect(200);
    bookingId = accepted.body.booking.id;
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('taşınma günü gelmeden iş tamamlanamaz ve yorum yazılamaz', async () => {
    const bookings = await http().get('/v1/bookings').set(auth('customer')).expect(200);
    expect(bookings.body.items[0]).toMatchObject({ id: bookingId, canComplete: false, review: null });
    const res = await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('company')).expect(409);
    expect(res.body.message).toContain('taşınma günü');
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 5 }).expect(409);
  });

  it('işin tarafı olmayan tamamlayamaz', async () => {
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('other')).expect(404);
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('otherCompany')).expect(404);
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('admin')).expect(403);
  });

  it('firma taşınma günü işi tamamlar; talep tamamlanır, müşteriden değerlendirme istenir', async () => {
    // Taşınma günü geldi
    await prisma.booking.update({ where: { id: bookingId }, data: { scheduledAt: new Date(inDays(0)) } });
    const company = await http().get('/v1/company/bookings').set(auth('company')).expect(200);
    expect(company.body.items[0]).toMatchObject({ id: bookingId, canComplete: true });

    const res = await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('company')).expect(200);
    expect(res.body).toMatchObject({ id: bookingId, status: 'COMPLETED' });
    await http().post(`/v1/bookings/${bookingId}/complete`).set(auth('customer')).expect(409);
    await events.drain();

    expect((await prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('COMPLETED');
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).completedJobs).toBe(1);
    const invite = mails(emails.customer, 'REVIEW_REQUEST');
    expect(invite).toHaveLength(1);
    expect(invite[0].content).toMatchObject({ path: `/hesabim/talepler/${requestId}#degerlendirme` });
  });

  it('geçersiz puan ya da çok kısa yorum reddedilir; yalnızca işin müşterisi değerlendirir', async () => {
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 6 }).expect(400);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 0 }).expect(400);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 4, comment: 'iyi' }).expect(400);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('other')).send({ rating: 1 }).expect(404);
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('company')).send({ rating: 5 }).expect(403);
  });

  it('müşteri puan ve yorum verir; firmanın ortalaması güncellenir, firmaya bildirilir', async () => {
    const res = await http()
      .post(`/v1/bookings/${bookingId}/review`)
      .set(auth('customer'))
      .send({ rating: 4, comment: '  Ekip özenliydi, yalnızca yarım saat geç geldiler.  ' })
      .expect(201);
    reviewId = res.body.id;
    expect(res.body).toMatchObject({ rating: 4, comment: 'Ekip özenliydi, yalnızca yarım saat geç geldiler.', isPublished: true, companyReply: null });
    await http().post(`/v1/bookings/${bookingId}/review`).set(auth('customer')).send({ rating: 5 }).expect(409);
    await events.drain();

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect([Number(company.ratingAverage), company.ratingCount]).toEqual([4, 1]);
    const notice = mails(emails.company, 'NEW_REVIEW');
    expect(notice).toHaveLength(1);
    expect(notice[0].content).toMatchObject({ title: 'Yeni değerlendirme: 4 yıldız', path: '/firma-paneli/degerlendirmeler' });

    const bookings = await http().get('/v1/bookings').set(auth('customer')).expect(200);
    expect(bookings.body.items[0]).toMatchObject({ status: 'COMPLETED', canComplete: false, review: { id: reviewId, rating: 4 } });
  });

  it('herkese açık firma sayfası puanı ve kısaltılmış adla yorumu gösterir', async () => {
    const profile = await http().get(`/v1/companies/${companyId}`).expect(200);
    expect(profile.body).toMatchObject({
      id: companyId,
      displayName: 'Puanlı Test Nakliyat',
      verified: true,
      ratingCount: 1,
      completedJobs: 1,
      description: 'İzmir merkezli taşımacılık.',
      ratingDistribution: { '5': 0, '4': 1, '3': 0, '2': 0, '1': 0 },
    });
    expect(Number(profile.body.ratingAverage)).toBe(4);
    expect(profile.body.serviceCities.map((c: { name: string }) => c.name)).toEqual(['Ankara', 'İzmir']);
    expect(profile.body).not.toHaveProperty('taxNumber');
    expect(profile.body).not.toHaveProperty('legalName');

    const reviews = await http().get(`/v1/companies/${companyId}/reviews`).expect(200);
    expect(reviews.body.total).toBe(1);
    expect(reviews.body.items[0]).toMatchObject({ rating: 4, authorName: 'Ayşe Y.', route: 'İzmir → Ankara' });
    expect(JSON.stringify(reviews.body)).not.toContain('Yorumcu');

    const list = await http().get('/v1/companies?reviewed=true&limit=1000').expect(200);
    expect(list.body.items.map((c: { id: string }) => c.id)).toContain(companyId);

    // Onaylanmamış firmanın sayfası yok
    await http().get(`/v1/companies/${otherCompanyId}`).expect(404);
    await http().get(`/v1/companies/${otherCompanyId}/reviews`).expect(404);
  });

  it('firma yoruma bir kez yanıt verir; başka firma yanıtlayamaz', async () => {
    await http().post(`/v1/company/reviews/${reviewId}/reply`).set(auth('otherCompany')).send({ body: 'Teşekkürler' }).expect(404);
    const res = await http()
      .post(`/v1/company/reviews/${reviewId}/reply`)
      .set(auth('company'))
      .send({ body: 'Gecikme için özür dileriz, yeni evinizde mutluluklar.' })
      .expect(200);
    expect(res.body.companyReply).toBe('Gecikme için özür dileriz, yeni evinizde mutluluklar.');
    await http().post(`/v1/company/reviews/${reviewId}/reply`).set(auth('company')).send({ body: 'İkinci yanıt' }).expect(409);

    const own = await http().get('/v1/company/reviews').set(auth('company')).expect(200);
    expect(own.body.summary).toMatchObject({ ratingCount: 1 });
    expect(own.body.items[0]).toMatchObject({ id: reviewId, customerName: 'Ayşe Yorumcu', route: 'İzmir → Ankara' });

    expect(own.body.summary.counts).toEqual({ total: 1, unanswered: 0, hidden: 0 });

    // Süzgeçler: yanıtlanan / yanıt bekleyen, puan, sıralama, arama
    const answered = await http().get('/v1/company/reviews?reply=answered&sort=lowest').set(auth('company')).expect(200);
    expect(answered.body.total).toBe(1);
    expect((await http().get('/v1/company/reviews?reply=unanswered').set(auth('company')).expect(200)).body.total).toBe(0);
    expect((await http().get('/v1/company/reviews?rating=1').set(auth('company')).expect(200)).body.total).toBe(0);
    expect((await http().get('/v1/company/reviews?q=Yorumcu').set(auth('company')).expect(200)).body.total).toBe(1);
    await http().get('/v1/company/reviews?sort=rastgele').set(auth('company')).expect(400);

    const reviews = await http().get(`/v1/companies/${companyId}/reviews`).expect(200);
    expect(reviews.body.items[0].companyReply).toBe('Gecikme için özür dileriz, yeni evinizde mutluluklar.');
  });

  it('yönetici yorumu gerekçeyle gizler: sayfadan ve ortalamadan çıkar, firma gerekçeyi görür; geri alabilir', async () => {
    await http().post(`/v1/admin/reviews/${reviewId}/hide`).set(auth('company')).send({ reason: 'Uygunsuz içerik' }).expect(403);
    await http().post(`/v1/admin/reviews/${reviewId}/hide`).set(auth('admin')).send({ reason: 'x' }).expect(400);
    await http().post(`/v1/admin/reviews/${reviewId}/hide`).set(auth('admin')).send({ reason: 'Yorumda kişisel bilgi var.' }).expect(200);

    expect((await http().get(`/v1/companies/${companyId}/reviews`).expect(200)).body.total).toBe(0);
    const profile = await http().get(`/v1/companies/${companyId}`).expect(200);
    expect([Number(profile.body.ratingAverage), profile.body.ratingCount]).toEqual([0, 0]);
    const own = await http().get('/v1/company/reviews').set(auth('company')).expect(200);
    expect(own.body.items[0]).toMatchObject({ isPublished: false, hiddenReason: 'Yorumda kişisel bilgi var.' });
    expect(own.body.summary.counts).toMatchObject({ total: 1, hidden: 1 });

    const adminList = await http().get(`/v1/admin/reviews?status=hidden&q=Puanl%C4%B1%20Test`).set(auth('admin')).expect(200);
    expect(adminList.body.items.map((r: { id: string }) => r.id)).toEqual([reviewId]);
    expect(adminList.body.stats.hidden).toBeGreaterThanOrEqual(1);
    expect(adminList.body.stats.total).toBeGreaterThanOrEqual(adminList.body.stats.hidden);
    const byCustomer = await http().get(`/v1/admin/reviews?reply=answered&sort=oldest&q=Ay%C5%9Fe%20Yorumcu`).set(auth('admin')).expect(200);
    expect(byCustomer.body.items.map((r: { id: string }) => r.id)).toContain(reviewId);
    const adminId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.admin } })).id;
    expect(await prisma.auditLog.count({ where: { actorId: adminId, action: 'review.hide', entityId: reviewId } })).toBe(1);

    await http().post(`/v1/admin/reviews/${reviewId}/show`).set(auth('admin')).expect(200);
    expect((await http().get(`/v1/companies/${companyId}`).expect(200)).body.ratingCount).toBe(1);
  });

  it('müşteri hesabı silinince yorum metni silinir, puan kalır', async () => {
    const customerId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } })).id;
    deletedIds.push(customerId);
    await http().delete(`/v1/admin/users/${customerId}`).set(auth('admin')).expect(204);
    const reviews = await http().get(`/v1/companies/${companyId}/reviews`).expect(200);
    expect(reviews.body.items[0]).toMatchObject({ rating: 4, comment: null, authorName: 'Müşteri' });
  });
});
