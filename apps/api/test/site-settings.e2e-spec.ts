import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { retryOnConflict } from './helpers.js';

// Arama motoru doğrulama kodları: herkese açık okuma, yalnızca yönetici değiştirir.
// Çalışan bir MariaDB/MySQL gerektirir.
describe('Site ayarları (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = { customer: '+905320009201', admin: '+905320009202' };
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.siteSettings.deleteMany();
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await retryOnConflict(cleanup);

    tokens.customer = (
      await http()
        .post('/v1/auth/register')
        .send({ role: 'CUSTOMER', fullName: 'Ayar Müşteri', phone: phones.customer, password: 'GucluSifre123' })
        .expect(201)
    ).body.accessToken;
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await retryOnConflict(cleanup);
    await app.close();
  });

  it('kayıt yokken kodlar boş', async () => {
    const res = await http().get('/v1/site-settings').expect(200);
    expect(res.body).toEqual({ verification: { google: null, bing: null, yandex: null } });
  });

  it('yalnızca yönetici değiştirir', async () => {
    await http().get('/v1/admin/site-settings').expect(401);
    await http().patch('/v1/admin/site-settings').set(auth('customer')).send({ google: 'abc' }).expect(403);
  });

  it('meta etiketinin tamamı yapıştırılırsa kodu ayıklar; gönderilmeyen kod değişmez, boş gönderilen kaldırılır', async () => {
    await http()
      .patch('/v1/admin/site-settings')
      .set(auth('admin'))
      .send({ google: '<meta name="google-site-verification" content="Abc_123-xyz" />', bing: 'B1N6' })
      .expect(200);
    let res = await http().get('/v1/site-settings').expect(200);
    expect(res.body.verification).toEqual({ google: 'Abc_123-xyz', bing: 'B1N6', yandex: null });

    await http().patch('/v1/admin/site-settings').set(auth('admin')).send({ bing: '', yandex: 'y4ndex' }).expect(200);
    res = await http().get('/v1/site-settings').expect(200);
    expect(res.body.verification).toEqual({ google: 'Abc_123-xyz', bing: null, yandex: 'y4ndex' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'site-settings.update' }, orderBy: { createdAt: 'desc' } });
    expect(log?.details).toMatchObject({ before: { bing: 'B1N6' }, after: { bing: null, yandex: 'y4ndex' } });
  });

  it('sayfaya etiket enjekte edebilecek kodu reddeder', async () => {
    await http().patch('/v1/admin/site-settings').set(auth('admin')).send({ google: '"><script>' }).expect(400);
    await http().patch('/v1/admin/site-settings').set(auth('admin')).send({ bilinmeyen: 'x' }).expect(400);
  });
});
