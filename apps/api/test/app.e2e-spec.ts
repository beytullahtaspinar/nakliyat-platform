import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL).
describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phone = '0532 000 00 01';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.refreshToken.deleteMany({ where: { user: { phone: '+905320000001' } } });
    await prisma.user.deleteMany({ where: { phone: '+905320000001' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect('X-Request-Id', /^[0-9a-f]{12}$/)
      .expect((res) => expect(res.body).toMatchObject({ status: 'ok', database: 'up' }));
  });

  it('hata yanıtları istek kimliğini taşır', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/olmayan-adres')
      .set('X-Request-Id', 'web-istek-123')
      .expect(404);
    expect(res.headers['x-request-id']).toBe('web-istek-123');
    expect(res.body).toMatchObject({ statusCode: 404, requestId: 'web-istek-123' });
  });

  it('bozuk JSON 400 döner', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bozuk')
      .expect(400);
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  it('GET /docs-json OpenAPI şemasını döner', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty('/v1/auth/login');
  });

  describe('Kimlik doğrulama', () => {
    let refreshToken: string;

    it('kayıt olur ve token döner', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ role: 'CUSTOMER', fullName: 'Test Müşteri', phone, password: 'GucluSifre123' })
        .expect(201);
      expect(res.body.user).toMatchObject({ role: 'CUSTOMER', phone: '+905320000001', phoneVerified: false });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('aynı telefonla ikinci kayıt 409 döner', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ role: 'CUSTOMER', fullName: 'Başka Biri', phone: '+905320000001', password: 'GucluSifre123' })
        .expect(409);
    });

    it('admin rolüyle kayıt kabul edilmez', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ role: 'ADMIN', fullName: 'Sahte Admin', phone: '05320000002', password: 'GucluSifre123' })
        .expect(400);
    });

    it('geçersiz telefon 400 döner', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ role: 'CUSTOMER', fullName: 'Test', phone: '0212 000 00 00', password: 'GucluSifre123' })
        .expect(400);
    });

    it('yanlış şifre 401 döner', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ phone, password: 'YanlisSifre' })
        .expect(401);
    });

    it('giriş yapar ve /me ile kullanıcıyı görür', async () => {
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ phone, password: 'GucluSifre123' })
        .expect(200);
      refreshToken = login.body.refreshToken;

      const me = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.fullName).toBe('Test Müşteri');
    });

    it('token olmadan /me 401 döner', () => {
      return request(app.getHttpServer()).get('/v1/auth/me').expect(401);
    });

    it('yenileme anahtarı tek kullanımlıktır', async () => {
      const first = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Eski anahtar tekrar kullanılırsa reddedilir ve tüm oturumlar kapanır
      await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken }).expect(401);
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(401);
    });
  });
});
