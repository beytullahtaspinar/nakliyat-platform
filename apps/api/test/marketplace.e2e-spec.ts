import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

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

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: allPhones } };
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
    await cleanup();
    await app.close();
  });

  it('müşteri İstanbul → Ankara talebi açar', async () => {
    const res = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        fromCityCode: '34', fromDistrict: 'kadikoy', fromAddress: 'Moda Cad. No:1 D:5', fromFloor: 3, fromHasElevator: false,
        toCityCode: '06', toDistrict: 'cankaya', toAddress: 'Atatürk Blv. No:10 D:2', toFloor: 2, toHasElevator: true,
        homeType: 'TWO_PLUS_ONE', moveDate: inDays(20),
      })
      .expect(201);
    requestId = res.body.id;
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
      request: { from: { address: 'Moda Cad. No:1 D:5', districtName: 'Kadıköy' } },
    });
    const customer = await http().get('/v1/bookings').set(auth('customer')).expect(200);
    expect(customer.body.items[0].company.contactPhone).toBe(phones.companyA);
  });

  it('kimlik bilgisi değişen firma yeniden doğrulamaya düşer', async () => {
    const res = await http().patch('/v1/company/profile').set(auth('companyB')).send({ taxNumber: '2222222223' }).expect(200);
    expect(res.body.verificationStatus).toBe('PENDING');
    const desc = await http().patch('/v1/company/profile').set(auth('companyC')).send({ description: 'Yeni açıklama' }).expect(200);
    expect(desc.body.verificationStatus).toBe('VERIFIED');
  });
});
