import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Firma rozetleri: belgeleri onaylı, hızlı yanıt, yüksek puan. Çalışan bir MariaDB/MySQL gerektirir.
describe('Firma rozetleri (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: DomainEvents;
  const phones = {
    customer: '+905320001301',
    fast: '+905320001302',
    slow: '+905320001303',
    admin: '+905320001304',
  };
  const tokens: Record<string, string> = {};
  let fastId: string;
  let slowId: string;
  const requestIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.quote.deleteMany({ where: { request: { customer: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const quote = (who: 'fast' | 'slow', requestId: string) =>
    http()
      .post(`/v1/company/requests/${requestId}/quotes`)
      .set(auth(who))
      .send({ priceTry: who === 'fast' ? 15000 : 16000, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(201);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    events = app.get(DomainEvents);
    await cleanup();

    for (const who of ['customer', 'fast', 'slow'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'customer' ? 'CUSTOMER' : 'COMPANY', fullName: `Rozet ${who}`, phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const create = (who: 'fast' | 'slow', taxNumber: string) =>
      http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `Rozet ${who} Ltd.`, displayName: `Rozet ${who} Nakliyat`, taxNumber, cityCode: '16', serviceCityCodes: ['16'] })
        .expect(201);
    fastId = (await create('fast', '7777771301')).body.id;
    slowId = (await create('slow', '7777771302')).body.id;
    await addApprovedDocuments(prisma, [fastId]);
    await http().post(`/v1/admin/companies/${fastId}/verify`).set(auth('admin')).expect(200);
    // Belge yüklemeden önce onaylanmış eski firma: doğrulanmış ama belge rozeti yok
    await prisma.company.update({ where: { id: slowId }, data: { verificationStatus: 'VERIFIED', verifiedAt: new Date() } });

    for (let i = 0; i < 5; i++) {
      const res = await http()
        .post('/v1/requests')
        .set(auth('customer'))
        .send({
          fromCityCode: '16', fromDistrict: 'nilufer', fromAddress: `Rozet Sok. No:${i + 1}`, fromFloor: 1, fromHasElevator: false,
          toCityCode: '16', toDistrict: 'osmangazi', toAddress: 'Hız Sok. No:2', toFloor: 2, toHasElevator: true,
          homeType: 'TWO_PLUS_ONE', moveDate: inDays(10 + i),
        })
        .expect(201);
      requestIds.push(res.body.id);
      await quote('fast', res.body.id);
    }
    // Yavaş firma talebe ancak 10 saat sonra teklif veriyor
    await prisma.movingRequest.updateMany({
      where: { id: { in: requestIds } },
      data: { publishedAt: new Date(Date.now() - 10 * 60 * 60_000) },
    });
    for (const id of requestIds) await quote('slow', id);
    await prisma.quote.updateMany({ where: { companyId: fastId }, data: { createdAt: new Date(Date.now() - 9 * 60 * 60_000) } });
    await prisma.company.update({ where: { id: fastId }, data: { ratingAverage: 4.8, ratingCount: 6 } });
    await prisma.company.update({ where: { id: slowId }, data: { ratingAverage: 5, ratingCount: 2 } });
    await events.drain();
  });

  afterAll(async () => {
    await events.drain();
    await cleanup();
    await app.close();
  });

  it('yayındaki talep yayına girdiği anı tutar', async () => {
    const created = await prisma.movingRequest.findMany({ where: { id: { in: requestIds } }, select: { publishedAt: true } });
    expect(created.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('teklif karşılaştırmada firmaların rozetleri görünür', async () => {
    const res = await http().get(`/v1/requests/${requestIds[0]}/quotes`).set(auth('customer')).expect(200);
    const byCompany = Object.fromEntries(res.body.map((q: { company: { id: string; badges: string[] } }) => [q.company.id, q.company.badges]));
    expect(byCompany[fastId]).toEqual(['DOCUMENTS_VERIFIED', 'FAST_RESPONSE', 'TOP_RATED']);
    // Az yorumla 5 puan rozet için yetmez
    expect(byCompany[slowId]).toEqual([]);
  });

  it('herkese açık firma sayfasında rozetler görünür', async () => {
    const res = await http().get(`/v1/companies/${fastId}`).expect(200);
    expect(res.body.badges).toEqual(['DOCUMENTS_VERIFIED', 'FAST_RESPONSE', 'TOP_RATED']);
  });

  it('K3 süresi dolunca belge rozeti düşer', async () => {
    await prisma.companyDocument.updateMany({
      where: { companyId: fastId, type: 'K3_LICENSE' },
      data: { validUntil: new Date(Date.now() - 2 * 86_400_000) },
    });
    const res = await http().get(`/v1/companies/${fastId}`).expect(200);
    expect(res.body.badges).toEqual(['FAST_RESPONSE', 'TOP_RATED']);
  });

  it('firma paneli rozet ilerlemesini gösterir', async () => {
    const res = await http().get('/v1/company/profile/badges').set(auth('slow')).expect(200);
    expect(res.body.documents).toMatchObject({ earned: false, companyVerified: true });
    expect(res.body.documents.missing).toHaveLength(3);
    expect(res.body.fastResponse).toMatchObject({ earned: false, quoteCount: 5, minQuotes: 5, maxMedianMinutes: 180 });
    expect(res.body.fastResponse.medianMinutes).toBeGreaterThanOrEqual(599);
    expect(res.body.topRated).toMatchObject({ earned: false, ratingAverage: 5, ratingCount: 2, minCount: 5 });
    await http().get('/v1/company/profile/badges').set(auth('customer')).expect(403);
  });
});
