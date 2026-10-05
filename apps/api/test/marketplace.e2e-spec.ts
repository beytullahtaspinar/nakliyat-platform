import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Talep → teklif → karşılaştırma → kabul akışının tamamı. Çalışan bir MariaDB/MySQL gerektirir.
describe('Pazaryeri akışı (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = {
    customer: '+905320000201',
    companyA: '+905320000202',
    companyB: '+905320000203',
    companyC: '+905320000204',
    admin: '+905320000205',
  };
  const allPhones = Object.values(phones);
  const tokens: Record<string, string> = {};
  const companyIds: Record<string, string> = {};
  let requestId: string;
  let quoteA: string;
  let quoteB: string;
  const deletedUserIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    // Silinen hesapların telefonu değiştiği için kimlikle de bulunur
    const users = { OR: [{ phone: { in: allPhones } }, { id: { in: deletedUserIds } }] };
    await prisma.booking.deleteMany({ where: { request: { customer: users } } });
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const register = async (who: keyof typeof phones, role: 'CUSTOMER' | 'COMPANY') => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ role, fullName: `Test ${who}`, phone: phones[who], password: 'GucluSifre123' })
      .expect(201);
    tokens[who] = res.body.accessToken;
  };

  const createProfile = async (who: 'companyA' | 'companyB' | 'companyC', taxNumber: string, cityCode: string, serviceCityCodes: string[]) => {
    const res = await http()
      .post('/v1/company/profile')
      .set(auth(who))
      .send({ legalName: `${who} Nakliyat Ltd.`, displayName: `${who} Nakliyat`, taxNumber, cityCode, serviceCityCodes })
      .expect(201);
    companyIds[who] = res.body.id;
    expect(res.body.verificationStatus).toBe('PENDING');
    await addApprovedDocuments(prisma, [res.body.id]);
  };

  const quoteBody = (priceTry: number) => ({ priceTry, crewSize: 3, vehicleType: 'KAMYON', includesPacking: true });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    await register('customer', 'CUSTOMER');
    await register('companyA', 'COMPANY');
    await register('companyB', 'COMPANY');
    await register('companyC', 'COMPANY');
    await markVerified(prisma, Object.values(phones));

    await prisma.user.create({
      data: {
        role: 'ADMIN',
        fullName: 'Test Admin',
        phone: phones.admin,
        passwordHash: await bcrypt.hash('GucluSifre123', 4),
      },
    });
    const login = await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200);
    tokens.admin = login.body.accessToken;
  });

  afterAll(async () => {
    // Arka planda çalışan bildirim dinleyicileri bitmeden kullanıcıları silme
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
  });

  it('müşteri İstanbul → Ankara talebi açar', async () => {
    const res = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '34', fromDistrict: 'kadikoy', fromAddress: 'Moda Cad. No:1 D:5', fromFloor: 3, fromHasElevator: false,
        fromLat: 40.9862, fromLng: 29.0254,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Atatürk Blv. No:10 D:2', toFloor: 2, toHasElevator: true,
        toLat: 39.9208, toLng: 32.8541,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(20),
      })
      .expect(201);
    requestId = res.body.id;
    expect(res.body).toMatchObject({ fromLat: 40.9862, toLng: 32.8541 });
  });

  it('firmalar profil oluşturur; aynı vergi no ikinci kez kullanılamaz', async () => {
    await createProfile('companyA', '1111111111', '34', ['34', '41']);
    await createProfile('companyB', '2222222222', '06', ['06']);
    await createProfile('companyC', '3333333333', '35', ['35']);
    await http()
      .post('/v1/company/profile')
      .set(auth('companyA'))
      .send({ legalName: 'Tekrar', displayName: 'Tekrar', taxNumber: '9999999999', cityCode: '34', serviceCityCodes: ['34'] })
      .expect(409);
  });

  it('doğrulanmamış firma teklif veremez', () => {
    return http().post(`/v1/company/requests/${requestId}/quotes`).set(auth('companyA')).send(quoteBody(20000)).expect(403);
  });

  it('yalnızca admin firmaları doğrular', async () => {
    await http().post(`/v1/admin/companies/${companyIds.companyA}/verify`).set(auth('companyA')).expect(403);
    const pending = await http().get('/v1/admin/companies?status=PENDING').set(auth('admin')).expect(200);
    expect(pending.body.items.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining([companyIds.companyA, companyIds.companyB, companyIds.companyC]),
    );
    for (const who of ['companyA', 'companyB', 'companyC'] as const) {
      await http().post(`/v1/admin/companies/${companyIds[who]}/verify`).set(auth('admin')).expect(200);
    }
    expect(await prisma.auditLog.count({ where: { entityId: companyIds.companyA, action: 'company.verify' } })).toBe(1);
  });

  it('firma hizmet bölgesindeki talebi müşteri bilgisi olmadan görür', async () => {
    const res = await http().get('/v1/company/requests').set(auth('companyA')).expect(200);
    const item = res.body.items.find((r: { id: string }) => r.id === requestId);
    expect(item).toMatchObject({ fromDistrictName: 'Kadıköy', toCityName: 'Ankara', myQuote: null });
    expect(item.fromAddress).toBeUndefined();
    expect(item.customerId).toBeUndefined();
    // Haritadaki işaret de açık adres kadar gizli
    expect(item.fromLat).toBeUndefined();
    expect(item.toLng).toBeUndefined();
    const detail = await http().get(`/v1/company/requests/${requestId}`).set(auth('companyA')).expect(200);
    expect(JSON.stringify(detail.body)).not.toMatch(/40\.9862|29\.0254|39\.9208|32\.8541/);
  });

  it('hizmet bölgesi dışındaki firma talebi göremez ve teklif veremez', async () => {
    const res = await http().get('/v1/company/requests').set(auth('companyC')).expect(200);
    expect(res.body.items.find((r: { id: string }) => r.id === requestId)).toBeUndefined();
    await http().post(`/v1/company/requests/${requestId}/quotes`).set(auth('companyC')).send(quoteBody(15000)).expect(404);
  });

  it('firmalar teklif verir; ikinci teklif reddedilir', async () => {
    const a = await http().post(`/v1/company/requests/${requestId}/quotes`).set(auth('companyA')).send(quoteBody(20000)).expect(201);
    quoteA = a.body.id;
    expect(a.body.priceTry).toBe('20000');
    await http().post(`/v1/company/requests/${requestId}/quotes`).set(auth('companyA')).send(quoteBody(21000)).expect(409);
    const b = await http().post(`/v1/company/requests/${requestId}/quotes`).set(auth('companyB')).send(quoteBody(17000)).expect(201);
    quoteB = b.body.id;
  });

  it('fiyat güncellemesi geçmişe kaydedilir; başka firma güncelleyemez', async () => {
    await http().patch(`/v1/company/quotes/${quoteA}`).set(auth('companyA')).send({ priceTry: 19000 }).expect(200);
    await http().patch(`/v1/company/quotes/${quoteA}`).set(auth('companyB')).send({ priceTry: 1000 }).expect(404);
    const revisions = await prisma.quoteRevision.findMany({ where: { quoteId: quoteA }, orderBy: { createdAt: 'asc' } });
    expect(revisions.map((r) => r.priceTry.toString())).toEqual(['20000', '19000']);
  });

  it('müşteri teklifleri fiyata göre sıralı ve firma gizli bilgileri olmadan görür', async () => {
    const res = await http().get(`/v1/requests/${requestId}/quotes`).set(auth('customer')).expect(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual([quoteB, quoteA]);
    expect(res.body[0].company).toMatchObject({ displayName: 'companyB Nakliyat', verified: true });
    expect(res.body[0].company.taxNumber).toBeUndefined();
    expect(res.body[0].company.contactPhone).toBeUndefined();
  });

  it('başka firmanın müşteri teklif listesine erişimi yok', () => {
    return http().get(`/v1/requests/${requestId}/quotes`).set(auth('companyA')).expect(403);
  });

  it('müşteri teklifi kabul eder: iletişim açılır, diğer teklif reddedilir', async () => {
    const res = await http().post(`/v1/quotes/${quoteA}/accept`).set(auth('customer')).expect(200);
    expect(res.body.company).toMatchObject({ contactPhone: phones.companyA });
    expect(res.body.booking.status).toBe('SCHEDULED');

    const [req, other] = await Promise.all([
      prisma.movingRequest.findUniqueOrThrow({ where: { id: requestId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: quoteB } }),
    ]);
    expect(req.status).toBe('BOOKED');
    expect(other.status).toBe('REJECTED');
  });

  it('ikinci kabul ve kapanmış talebe teklif reddedilir', async () => {
    await http().post(`/v1/quotes/${quoteB}/accept`).set(auth('customer')).expect(409);
    await http().patch(`/v1/company/quotes/${quoteA}`).set(auth('companyA')).send({ priceTry: 18000 }).expect(409);
  });

  it('taraflar işte birbirinin iletişim bilgisini görür', async () => {
    const company = await http().get('/v1/company/bookings').set(auth('companyA')).expect(200);
    expect(company.body.items[0]).toMatchObject({
      priceTry: '19000',
      customer: { phone: phones.customer },
      request: {
        from: { address: 'Moda Cad. No:1 D:5', districtName: 'Kadıköy', location: { lat: 40.9862, lng: 29.0254 } },
        to: { location: { lat: 39.9208, lng: 32.8541 } },
      },
    });
    const customer = await http().get('/v1/bookings').set(auth('customer')).expect(200);
    expect(customer.body.items[0].company.contactPhone).toBe(phones.companyA);
  });

  it('yönetim ekranı uçları yalnızca admine açık', async () => {
    for (const path of ['/v1/admin/summary', '/v1/admin/requests', '/v1/admin/users', `/v1/admin/companies/${companyIds.companyA}`]) {
      await http().get(path).set(auth('customer')).expect(403);
      await http().get(path).set(auth('companyA')).expect(403);
    }
  });

  it('admin özeti, talepleri ve kullanıcıları görür', async () => {
    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.companies.verified).toBeGreaterThanOrEqual(3);
    expect(summary.body.bookings.scheduled).toBeGreaterThanOrEqual(1);

    const requests = await http().get('/v1/admin/requests?status=BOOKED').set(auth('admin')).expect(200);
    const item = requests.body.items.find((r: { id: string }) => r.id === requestId);
    expect(item).toMatchObject({ quoteCount: 2, fromDistrictName: 'Kadıköy', customer: { phone: phones.customer } });

    const users = await http().get('/v1/admin/users?role=COMPANY&q=0532 000 02').set(auth('admin')).expect(200);
    const ids = users.body.items.map((u: { phone: string }) => u.phone);
    expect(ids).toEqual(expect.arrayContaining([phones.companyA, phones.companyB]));
    expect(ids).not.toContain(phones.customer);
    expect(users.body.items[0].passwordHash).toBeUndefined();
  });

  it('admin firma detayında sahibi ve karar geçmişini görür; reddedince gerekçe kaydedilir', async () => {
    await http().post(`/v1/admin/companies/${companyIds.companyC}/reject`).set(auth('admin')).send({ reason: 'K3 belgesi geçersiz' }).expect(200);
    const res = await http().get(`/v1/admin/companies/${companyIds.companyC}`).set(auth('admin')).expect(200);
    expect(res.body).toMatchObject({
      verificationStatus: 'REJECTED',
      verificationNote: 'K3 belgesi geçersiz',
      owner: { phone: phones.companyC },
      requirements: [
        { type: 'K3_LICENSE', state: 'VERIFIED' },
        { type: 'TAX_CERTIFICATE', state: 'VERIFIED' },
        { type: 'TRADE_REGISTRY', state: 'VERIFIED' },
      ],
    });
    expect(res.body.documents).toHaveLength(3);
    expect(res.body.history.map((h: { action: string }) => h.action)).toEqual(['company.reject', 'company.verify']);
    await http().post(`/v1/admin/companies/${companyIds.companyC}/verify`).set(auth('admin')).expect(200);
    await http().get('/v1/admin/companies/yok').set(auth('admin')).expect(404);
  });

  it('kimlik bilgisi değişen firma yeniden doğrulamaya düşer', async () => {
    const res = await http().patch('/v1/company/profile').set(auth('companyB')).send({ taxNumber: '2222222223' }).expect(200);
    expect(res.body.verificationStatus).toBe('PENDING');
    const desc = await http().patch('/v1/company/profile').set(auth('companyC')).send({ description: 'Yeni açıklama' }).expect(200);
    expect(desc.body.verificationStatus).toBe('VERIFIED');
  });
  it('admin firma bilgilerini düzeltir; doğrulama durumu korunur, vergi no çakışması reddedilir', async () => {
    const res = await http()
      .patch(`/v1/admin/companies/${companyIds.companyC}`)
      .set(auth('admin'))
      .send({ displayName: 'C Nakliyat Yeni', k3LicenseNumber: 'K3.35.111', serviceCityCodes: ['35', '09'] })
      .expect(200);
    expect(res.body).toMatchObject({ displayName: 'C Nakliyat Yeni', verificationStatus: 'VERIFIED', serviceCityCodes: ['09', '35'] });
    await http().patch(`/v1/admin/companies/${companyIds.companyC}`).set(auth('admin')).send({ taxNumber: '1111111111' }).expect(409);
    await http().patch(`/v1/admin/companies/${companyIds.companyC}`).set(auth('companyC')).send({ displayName: 'X' }).expect(403);
    const log = await prisma.auditLog.findFirst({ where: { entityId: companyIds.companyC, action: 'company.update' } });
    expect(log?.details).toMatchObject({ fields: expect.arrayContaining(['displayName', 'k3LicenseNumber', 'serviceCityCodes']) });
  });

  it('admin kullanıcı bilgilerini günceller; telefon çakışması reddedilir', async () => {
    const id = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } })).id;
    const res = await http()
      .patch(`/v1/admin/users/${id}`)
      .set(auth('admin'))
      .send({ fullName: 'Ayşe Müşteri', email: 'AYSE@ornek.com' })
      .expect(200);
    expect(res.body).toMatchObject({ fullName: 'Ayşe Müşteri', email: 'ayse@ornek.com', history: [{ action: 'user.update' }] });
    expect(res.body.passwordHash).toBeUndefined();
    await http().patch(`/v1/admin/users/${id}`).set(auth('admin')).send({ phone: phones.companyA }).expect(409);
    await http().patch(`/v1/admin/users/${id}`).set(auth('admin')).send({ email: '' }).expect(200);
    await http().patch(`/v1/admin/users/${id}`).set(auth('companyA')).send({ fullName: 'X' }).expect(403);
  });

  it('admin yeni şifre belirler: eski şifre ve açık oturumlar geçersiz olur', async () => {
    const login = await http().post('/v1/auth/login').send({ phone: phones.companyB, password: 'GucluSifre123' }).expect(200);
    const id = login.body.user.id;
    await http().post(`/v1/admin/users/${id}/password`).set(auth('admin')).send({ password: 'kisa' }).expect(400);
    await http().post(`/v1/admin/users/${id}/password`).set(auth('admin')).send({ password: 'YeniSifre2026' }).expect(204);
    await http().post('/v1/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(401);
    await http().post('/v1/auth/login').send({ phone: phones.companyB, password: 'GucluSifre123' }).expect(401);
    await http().post('/v1/auth/login').send({ phone: phones.companyB, password: 'YeniSifre2026' }).expect(200);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: 'user.password_set' } })).toBe(1);
  });

  it('askıya alınan hesabın açık oturumu hemen kapanır; admin kendini askıya alamaz', async () => {
    const id = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.companyC } })).id;
    await http().get('/v1/company/profile').set(auth('companyC')).expect(200);
    await http().patch(`/v1/admin/users/${id}`).set(auth('admin')).send({ status: 'SUSPENDED' }).expect(200);
    await http().get('/v1/company/profile').set(auth('companyC')).expect(401);
    await http().patch(`/v1/admin/users/${id}`).set(auth('admin')).send({ status: 'ACTIVE' }).expect(200);
    await http().get('/v1/company/profile').set(auth('companyC')).expect(200);

    const adminId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.admin } })).id;
    await http().patch(`/v1/admin/users/${adminId}`).set(auth('admin')).send({ status: 'SUSPENDED' }).expect(400);
  });

  it('rolü değişen kullanıcının eski anahtarı yeni rolle değerlendirilir', async () => {
    await prisma.user.update({ where: { phone: phones.companyA }, data: { role: 'ADMIN' } });
    await http().get('/v1/admin/summary').set(auth('companyA')).expect(200);
    await prisma.user.update({ where: { phone: phones.companyA }, data: { role: 'COMPANY' } });
    await http().get('/v1/admin/summary').set(auth('companyA')).expect(403);
  });
  it('admin firma ve talepleri arar, talep kaydını teklifleriyle görür', async () => {
    const companies = await http().get('/v1/admin/companies?q=companyB').set(auth('admin')).expect(200);
    expect(companies.body.items.map((c: { id: string }) => c.id)).toEqual([companyIds.companyB]);
    const byPhone = await http().get('/v1/admin/companies?q=0532 000 0202').set(auth('admin')).expect(200);
    expect(byPhone.body.items.map((c: { id: string }) => c.id)).toEqual([companyIds.companyA]);

    const requests = await http().get('/v1/admin/requests?q=0532 000 0201').set(auth('admin')).expect(200);
    expect(requests.body.items.map((r: { id: string }) => r.id)).toContain(requestId);

    const detail = await http().get(`/v1/admin/requests/${requestId}`).set(auth('admin')).expect(200);
    expect(detail.body).toMatchObject({
      fromAddress: 'Moda Cad. No:1 D:5',
      customer: { phone: phones.customer },
      booking: { status: 'SCHEDULED' },
    });
    expect(detail.body.quotes.map((q: { id: string }) => q.id)).toEqual([quoteB, quoteA]);
    await http().get('/v1/admin/requests/yok').set(auth('admin')).expect(404);
    await http().get(`/v1/admin/requests/${requestId}`).set(auth('customer')).expect(403);
  });

  it('admin hesabı siler: kişisel bilgiler silinir, giriş kapanır, kayıtlar kalır', async () => {
    const idOf = async (who: keyof typeof phones) => (await prisma.user.findUniqueOrThrow({ where: { phone: phones[who] } })).id;
    const [adminId, customerId, companyAId, companyBId] = await Promise.all(
      (['admin', 'customer', 'companyA', 'companyB'] as const).map(idOf),
    );

    await http().delete(`/v1/admin/users/${adminId}`).set(auth('admin')).expect(400);
    // Planlanmış işi olan taraflar silinemez
    await http().delete(`/v1/admin/users/${customerId}`).set(auth('admin')).expect(409);
    await http().delete(`/v1/admin/users/${companyAId}`).set(auth('admin')).expect(409);
    await http().delete(`/v1/admin/users/${companyBId}`).set(auth('companyA')).expect(403);

    deletedUserIds.push(companyBId);
    await http().delete(`/v1/admin/users/${companyBId}`).set(auth('admin')).expect(204);
    await http().delete(`/v1/admin/users/${companyBId}`).set(auth('admin')).expect(404);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: companyBId }, include: { company: true } });
    expect(row).toMatchObject({ fullName: 'Silinmiş kullanıcı', email: null, phone: `silindi-${companyBId}` });
    expect(row.deletedAt).not.toBeNull();
    expect(row.company?.deletedAt).not.toBeNull();
    expect(await prisma.quote.count({ where: { id: quoteB } })).toBe(1);

    await http().post('/v1/auth/login').send({ phone: phones.companyB, password: 'GucluSifre123' }).expect(401);
    await http().get('/v1/company/profile').set(auth('companyB')).expect(401);
    await http().get(`/v1/admin/users/${companyBId}`).set(auth('admin')).expect(404);
    await http().get(`/v1/admin/companies/${companyIds.companyB}`).set(auth('admin')).expect(404);
    const log = await prisma.auditLog.findFirst({ where: { entityId: companyBId, action: 'user.delete' } });
    expect(log?.details).toEqual({ role: 'COMPANY' });
  });

  it('yönetici firma paneline geçer: firmanın gözünden çalışır, her değişiklik kaydedilir', async () => {
    const res = await http().post(`/v1/admin/companies/${companyIds.companyC}/impersonate`).set(auth('admin')).expect(200);
    expect(res.body).toMatchObject({ expiresIn: 1800, company: { id: companyIds.companyC } });
    const asCompany = { Authorization: `Bearer ${res.body.accessToken}` };

    const profile = await http().get('/v1/company/profile').set(asCompany).expect(200);
    expect(profile.body.id).toBe(companyIds.companyC);
    await http().patch('/v1/company/profile').set(asCompany).send({ description: 'Yönetici düzeltti' }).expect(200);
    // Görüntüleme anahtarı firma yetkisindedir, yönetim uçlarını açmaz
    await http().get('/v1/admin/summary').set(asCompany).expect(403);

    const adminId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.admin } })).id;
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Company', entityId: companyIds.companyC, action: { startsWith: 'company.impersonate' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => [l.action, l.actorId])).toEqual([
      ['company.impersonate', adminId],
      ['company.impersonate.action', adminId],
    ]);
    expect(logs[1].details).toEqual({ method: 'PATCH', path: '/v1/company/profile' });

    // Yönetici yetkisini kaybedince anahtar da geçersiz olur
    await prisma.user.update({ where: { id: adminId }, data: { status: 'SUSPENDED' } });
    await http().get('/v1/company/profile').set(asCompany).expect(401);
    await prisma.user.update({ where: { id: adminId }, data: { status: 'ACTIVE' } });

    await http().post(`/v1/admin/companies/${companyIds.companyC}/impersonate`).set(auth('companyA')).expect(403);
    await http().post('/v1/admin/companies/yok/impersonate').set(auth('admin')).expect(404);
  });

  it('yönetici müşteri hesabına geçer: müşterinin gözünden çalışır, her değişiklik kaydedilir', async () => {
    const adminId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.admin } })).id;
    const customerId = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } })).id;
    const res = await http().post(`/v1/admin/users/${customerId}/impersonate`).set(auth('admin')).expect(200);
    expect(res.body).toMatchObject({ expiresIn: 1800, user: { id: customerId } });
    const asCustomer = { Authorization: `Bearer ${res.body.accessToken}` };

    const me = await http().get('/v1/auth/me').set(asCustomer).expect(200);
    expect(me.body).toMatchObject({ id: customerId, role: 'CUSTOMER' });
    await http().get('/v1/requests').set(asCustomer).expect(200);
    await http().patch('/v1/notifications/preferences').set(asCustomer).send({ items: [] }).expect(200);
    // Herkese açık yorum müşterinin kendi görüşü: yönetici müşteri adına yazamaz
    const booking = await prisma.booking.findFirstOrThrow({ where: { request: { customerId } } });
    await http().post(`/v1/bookings/${booking.id}/review`).set(asCustomer).send({ rating: 5 }).expect(403);
    await http().get('/v1/admin/summary').set(asCustomer).expect(403);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: customerId, action: { startsWith: 'user.impersonate' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => [l.action, l.actorId])).toEqual([
      ['user.impersonate', adminId],
      ['user.impersonate.action', adminId],
    ]);
    expect(logs[1].details).toEqual({ method: 'PATCH', path: '/v1/notifications/preferences' });

    // Yönetici ve firma hesaplarına, başkasına ait yetkiyle ya da askıdaki hesaba geçilmez
    await http().post(`/v1/admin/users/${adminId}/impersonate`).set(auth('admin')).expect(403);
    const companyCOwner = (await prisma.user.findUniqueOrThrow({ where: { phone: phones.companyC } })).id;
    await http().post(`/v1/admin/users/${companyCOwner}/impersonate`).set(auth('admin')).expect(400);
    await http().post(`/v1/admin/users/${customerId}/impersonate`).set(auth('companyA')).expect(403);
    await http().post(`/v1/admin/users/${customerId}/impersonate`).set(asCustomer).expect(403);
    await prisma.user.update({ where: { id: customerId }, data: { status: 'SUSPENDED' } });
    await http().post(`/v1/admin/users/${customerId}/impersonate`).set(auth('admin')).expect(400);
    await prisma.user.update({ where: { id: customerId }, data: { status: 'ACTIVE' } });
    await http().post('/v1/admin/users/yok/impersonate').set(auth('admin')).expect(404);
  });

});
