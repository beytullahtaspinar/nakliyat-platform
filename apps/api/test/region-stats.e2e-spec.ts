import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { retryOnConflict } from './helpers.js';

// Bölge sayfalarındaki gerçek teklif verisi: eşikler, geri çekilen teklif ve doğrulanmamış firma hariç.
// Çalışan bir MariaDB/MySQL gerektirir. Veri Tunceli (62) içinde: başka testler bu ili kullanmaz.
describe('Bölge teklif istatistikleri (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const CITY = '62';
  const phones = {
    customer: '+905320009101',
    a: '+905320009102',
    b: '+905320009103',
    unverified: '+905320009104',
  };
  const users = { phone: { in: Object.values(phones) } };

  const http = () => request(app.getHttpServer());

  const cleanup = async () => {
    await prisma.quote.deleteMany({ where: { company: { owner: users } } });
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await retryOnConflict(cleanup);

    const user = (phone: string, role: 'CUSTOMER' | 'COMPANY') =>
      prisma.user.create({ data: { role, fullName: `İstatistik ${phone.slice(-3)}`, phone, passwordHash: 'x' } });
    const customer = await user(phones.customer, 'CUSTOMER');
    const company = async (phone: string, n: number, verified: boolean) =>
      prisma.company.create({
        data: {
          ownerId: (await user(phone, 'COMPANY')).id,
          legalName: `İstatistik ${n} Ltd.`,
          displayName: `İstatistik ${n}`,
          taxNumber: `99909101${n}0`,
          cityCode: CITY,
          verificationStatus: verified ? 'VERIFIED' : 'PENDING',
          serviceCities: { create: { cityCode: CITY } },
        },
      });
    const a = await company(phones.a, 1, true);
    const b = await company(phones.b, 2, true);
    const unverified = await company(phones.unverified, 3, false);

    const newRequest = (homeType: 'TWO_PLUS_ONE' | 'ONE_PLUS_ONE') =>
      prisma.movingRequest.create({
        data: {
          customerId: customer.id,
          status: 'OPEN',
          fromCityCode: CITY,
          fromDistrict: 'merkez',
          fromAddress: 'Test sokak',
          fromFloor: 2,
          fromHasElevator: false,
          toCityCode: CITY,
          toDistrict: 'merkez',
          toAddress: 'Test cadde',
          toFloor: 1,
          toHasElevator: false,
          homeType,
          moveDate: new Date(Date.now() + 7 * 86_400_000),
          specialItems: [],
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
    const quote = (requestId: string, companyId: string, priceTry: number, status: 'PENDING' | 'WITHDRAWN' = 'PENDING') =>
      prisma.quote.create({
        data: {
          requestId,
          companyId,
          priceTry,
          status,
          crewSize: 3,
          vehicleType: 'KAMYONET',
          validUntil: new Date(Date.now() + 3 * 86_400_000),
        },
      });

    // 2+1: iki doğrulanmış firmadan 6 teklif (gösterilir)
    const prices = [10000, 12000, 14000, 16000, 18000, 20000];
    for (const [i, price] of prices.entries()) {
      const r = await newRequest('TWO_PLUS_ONE');
      await quote(r.id, i % 2 === 0 ? a.id : b.id, price);
      // Geri çekilen ve doğrulanmamış firmanın teklifi sayılmaz
      if (i === 0) {
        await quote(r.id, unverified.id, 999_000);
        await quote(r.id, b.id, 500_000, 'WITHDRAWN');
      }
    }
    // 1+1: tek firmadan 5 teklif (firmanın fiyatı açığa çıkmasın diye gizli)
    for (const price of [8000, 8500, 9000, 9500, 10000]) {
      const r = await newRequest('ONE_PLUS_ONE');
      await quote(r.id, a.id, price);
    }
  });

  afterAll(async () => {
    await retryOnConflict(cleanup);
    await app.close();
  });

  it('il içi teklifleri ev tipine göre çeyreklerle verir; eşiği geçmeyen satır gizlenir', async () => {
    const res = await http().get(`/v1/pricing/regions/${CITY}/${CITY}`).expect(200);
    expect(res.body).toMatchObject({ fromCityCode: CITY, toCityCode: CITY, days: 90, requestCount: 11, quoteCount: 11 });
    expect(res.body.verifiedCompanyCount).toBeGreaterThanOrEqual(2);
    expect(res.body.priceRanges).toEqual([
      { homeType: 'TWO_PLUS_ONE', quoteCount: 6, companyCount: 2, p25: 12500, median: 15000, p75: 17500 },
    ]);
  });

  it('başka güzergâhta veri yoksa boş liste, bilinmeyen ilde 404', async () => {
    const res = await http().get(`/v1/pricing/regions/${CITY}/06`).expect(200);
    expect(res.body.priceRanges).toEqual([]);
    await http().get('/v1/pricing/regions/99/06').expect(404);
  });
});
