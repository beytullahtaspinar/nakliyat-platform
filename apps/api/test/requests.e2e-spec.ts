import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Çalışan bir PostgreSQL gerektirir (DATABASE_URL).
describe('Taşıma talepleri (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken: string;
  let otherCustomerToken: string;
  let companyToken: string;
  const phones = ['+905320000101', '+905320000102', '+905320000103'];

  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const validBody = () => ({
    fromCityCode: '34',
    fromDistrict: 'kadikoy',
    fromAddress: 'Caferağa Mah. Moda Cad. No:1 D:5',
    fromFloor: 3,
    fromHasElevator: false,
    toCityCode: '06',
    toDistrict: 'cankaya',
    toAddress: 'Kızılay Mah. Atatürk Blv. No:10 D:2',
    toFloor: 2,
    toHasElevator: true,
    homeType: 'TWO_PLUS_ONE',
    moveDate: inDays(20),
    needsPacking: true,
    specialItems: ['Piyano'],
  });

  const register = async (phone: string, role: 'CUSTOMER' | 'COMPANY') => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ role, fullName: 'Test Kullanıcı', phone, password: 'GucluSifre123' })
      .expect(201);
    return res.body.accessToken as string;
  };

  const cleanup = async () => {
    await prisma.movingRequest.deleteMany({ where: { customer: { phone: { in: phones } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone: { in: phones } } } });
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    customerToken = await register(phones[0]!, 'CUSTOMER');
    otherCustomerToken = await register(phones[1]!, 'CUSTOMER');
    companyToken = await register(phones[2]!, 'COMPANY');
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('il ve ilçe listesi herkese açık', async () => {
    const cities = await request(app.getHttpServer()).get('/v1/locations/cities').expect(200);
    expect(cities.body).toHaveLength(81);
    const districts = await request(app.getHttpServer()).get('/v1/locations/cities/34/districts').expect(200);
    expect(districts.body).toContainEqual({ name: 'Kadıköy', slug: 'kadikoy' });
  });

  let requestId: string;

  it('müşteri talep oluşturur, sistem tahmin ekler', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/requests')
      .set(auth(customerToken))
      .send(validBody())
      .expect(201);
    requestId = res.body.id;
    expect(res.body).toMatchObject({
      status: 'OPEN',
      fromCityName: 'İstanbul',
      fromDistrictName: 'Kadıköy',
      toCityName: 'Ankara',
      toDistrictName: 'Çankaya',
      estimatedVolumeM3: 25,
      estimatedCrew: 3,
      quoteCount: 0,
    });
    expect(res.body.distanceKm).toBeGreaterThan(400);
    expect(res.body.estimatedHours).toBeGreaterThan(6);
  });

  it('ilçe ile uyuşmayan il reddedilir', () => {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set(auth(customerToken))
      .send({ ...validBody(), fromDistrict: 'cankaya' })
      .expect(400);
  });

  it('bugün veya geçmiş tarih reddedilir', () => {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set(auth(customerToken))
      .send({ ...validBody(), moveDate: inDays(0) })
      .expect(400);
  });

  it('firma hesabı talep oluşturamaz', () => {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set(auth(companyToken))
      .send(validBody())
      .expect(403);
  });

  it('müşteri kendi taleplerini listeler', async () => {
    const res = await request(app.getHttpServer()).get('/v1/requests').set(auth(customerToken)).expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(res.body.items[0].id).toBe(requestId);
  });

  it('başka müşterinin talebi görünmez', async () => {
    await request(app.getHttpServer()).get(`/v1/requests/${requestId}`).set(auth(otherCustomerToken)).expect(404);
    const res = await request(app.getHttpServer()).get('/v1/requests').set(auth(otherCustomerToken)).expect(200);
    expect(res.body.total).toBe(0);
  });

  it('şehir içine çevrilince mesafe kalkar ve tahmin güncellenir', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/requests/${requestId}`)
      .set(auth(customerToken))
      .send({ toCityCode: '34', toDistrict: 'uskudar' })
      .expect(200);
    expect(res.body).toMatchObject({ toCityName: 'İstanbul', toDistrictName: 'Üsküdar', distanceKm: null });
  });

  it('talep iptal edilir, sonra düzenlenemez', async () => {
    await request(app.getHttpServer())
      .post(`/v1/requests/${requestId}/cancel`)
      .set(auth(customerToken))
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('CANCELLED'));
    await request(app.getHttpServer())
      .patch(`/v1/requests/${requestId}`)
      .set(auth(customerToken))
      .send({ notes: 'değişiklik' })
      .expect(409);
  });
});
