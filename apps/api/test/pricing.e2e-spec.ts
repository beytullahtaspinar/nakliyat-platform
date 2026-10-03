import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DEFAULT_PRICING_SETTINGS } from '@nakliyat/pricing';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Fiyat hesaplayıcı katsayıları: herkese açık okuma, yalnızca yönetici değiştirir.
// Çalışan bir MariaDB/MySQL gerektirir.
describe('Fiyat hesaplayıcı (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = { customer: '+905320001201', admin: '+905320001202' };
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.pricingSettings.deleteMany();
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    tokens.customer = (
      await http()
        .post('/v1/auth/register')
        .send({ role: 'CUSTOMER', fullName: 'Fiyat Müşteri', phone: phones.customer, password: 'GucluSifre123' })
        .expect(201)
    ).body.accessToken;
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('kayıt yokken varsayılan katsayıları herkese açık verir', async () => {
    const res = await http().get('/v1/pricing').expect(200);
    expect(res.body.settings).toEqual(DEFAULT_PRICING_SETTINGS);
    expect(res.body.updatedAt).toBeNull();
    expect(res.body.calibration).toBeTypeOf('object');
  });

  it('katsayıları yalnızca yönetici değiştirir', async () => {
    await http().get('/v1/admin/pricing').expect(401);
    await http().patch('/v1/admin/pricing').set(auth('customer')).send({ perKmTry: 60 }).expect(403);
  });

  it('aralık dışı ve bilinmeyen alanları reddeder', async () => {
    await http().patch('/v1/admin/pricing').set(auth('admin')).send({ perKmTry: -1 }).expect(400);
    await http().patch('/v1/admin/pricing').set(auth('admin')).send({ spreadPct: 'çok' }).expect(400);
    await http().patch('/v1/admin/pricing').set(auth('admin')).send({ bilinmeyen: 1 }).expect(400);
  });

  it('değişikliği kaydeder, herkese açık modele yansıtır ve karar geçmişine yazar', async () => {
    const res = await http().patch('/v1/admin/pricing').set(auth('admin')).send({ perKmTry: 60, spreadPct: 20 }).expect(200);
    expect(res.body.settings).toEqual({ ...DEFAULT_PRICING_SETTINGS, perKmTry: 60, spreadPct: 20 });
    expect(res.body.defaults).toEqual(DEFAULT_PRICING_SETTINGS);
    expect(res.body.sampleCounts).toMatchObject({ local: expect.any(Number), intercity: expect.any(Number) });

    // Kısmi güncelleme diğer değerleri korur
    await http().patch('/v1/admin/pricing').set(auth('admin')).send({ baseFeeTry: 2500 }).expect(200);
    const pub = await http().get('/v1/pricing').expect(200);
    expect(pub.body.settings).toMatchObject({ perKmTry: 60, spreadPct: 20, baseFeeTry: 2500 });
    expect(pub.body.updatedAt).not.toBeNull();

    const logs = await prisma.auditLog.findMany({ where: { action: 'pricing.update', actor: { phone: phones.admin } }, orderBy: { createdAt: 'asc' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]!.details).toMatchObject({ before: { perKmTry: DEFAULT_PRICING_SETTINGS.perKmTry }, after: { perKmTry: 60 } });
  });
});
