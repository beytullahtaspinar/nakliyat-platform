import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { OAUTH_ONLY_PASSWORD } from './../src/auth/auth.service.js';
import type { Prisma } from './../src/generated/prisma/client.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Kullanıcının kendi hesabını silmesi (DELETE /auth/me). Çalışan bir MariaDB/MySQL gerektirir.
describe('Hesabımı sil (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = { customer: '+905320001601', company: '+905320001602', oauth: '+905320001603', admin: '+905320001604' };
  const password = 'GucluSifre123';
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const removeUsers = async (where: Prisma.UserWhereInput) => {
    await prisma.company.deleteMany({ where: { owner: where } });
    await prisma.user.deleteMany({ where });
  };
  const idOf = async (who: keyof typeof phones) => (await prisma.user.findUniqueOrThrow({ where: { phone: phones[who] } })).id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await removeUsers({ phone: { in: Object.values(phones) } });
    for (const who of ['customer', 'company'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who.toUpperCase(), fullName: `Silme ${who}`, phone: phones[who], password })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await prisma.company.create({
      data: { ownerId: await idOf('company'), legalName: 'Silme Nakliyat Ltd.', displayName: 'Silme Nakliyat', taxNumber: '9990016020', cityCode: '34' },
    });
    // Yalnızca Google/Apple ile açılmış hesap ve yönetici: anahtar doğrudan imzalanır
    const jwt = app.get(JwtService);
    for (const [who, role] of [['oauth', 'CUSTOMER'], ['admin', 'ADMIN']] as const) {
      const user = await prisma.user.create({
        data: { role, fullName: `Silme ${who}`, phone: phones[who], passwordHash: OAUTH_ONLY_PASSWORD },
      });
      tokens[who] = await jwt.signAsync({ sub: user.id, role });
    }
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    const ids = await prisma.auditLog.findMany({ where: { action: 'user.self_delete' }, select: { entityId: true } });
    await prisma.auditLog.deleteMany({ where: { action: 'user.self_delete', entityId: { in: ids.map((l) => l.entityId) } } });
    await removeUsers({ OR: [{ phone: { in: Object.values(phones) } }, { id: { in: ids.map((l) => l.entityId) } }] });
    await app.close();
  });

  it('hesap bilgisinde şifre olup olmadığı görünür', async () => {
    expect((await http().get('/v1/auth/me').set(auth('customer')).expect(200)).body.hasPassword).toBe(true);
    expect((await http().get('/v1/auth/me').set(auth('oauth')).expect(200)).body.hasPassword).toBe(false);
  });

  it('şifreli hesap şifresini doğru girmeden silinemez', async () => {
    await http().delete('/v1/auth/me').set(auth('customer')).send({}).expect(400);
    await http().delete('/v1/auth/me').set(auth('customer')).send({ password: 'YanlisSifre1' }).expect(400);
    await http().delete('/v1/auth/me').send({ password }).expect(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } })).deletedAt).toBeNull();
  });

  it('yönetici hesabı kendini buradan silemez', async () => {
    await http().delete('/v1/auth/me').set(auth('admin')).send({}).expect(403);
  });

  it('müşteri kendi hesabını siler; kişisel veri silinir, bir daha giriş yapılamaz', async () => {
    const id = await idOf('customer');
    await http().delete('/v1/auth/me').set(auth('customer')).send({ password }).expect(204);

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ fullName: 'Silinmiş kullanıcı', phone: `silindi-${id}`, email: null, passwordHash: '!' });
    expect(user.deletedAt).not.toBeNull();
    expect(await prisma.refreshToken.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'user.self_delete', entityId: id, actorId: id } })).toBe(1);

    await http().post('/v1/auth/login').send({ phone: phones.customer, password }).expect(401);
    await http().get('/v1/auth/me').set(auth('customer')).expect(401);
    await http().delete('/v1/auth/me').set(auth('customer')).send({ password }).expect(401);
  });

  it('firma hesabı silinir; firma listelerden kalkar', async () => {
    const id = await idOf('company');
    await http().delete('/v1/auth/me').set(auth('company')).send({ password }).expect(204);
    const company = await prisma.company.findUniqueOrThrow({ where: { ownerId: id } });
    expect(company.deletedAt).not.toBeNull();
    expect(company.taxNumber).toBe(`silindi-${company.id}`);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
  });

  it('yalnızca Google/Apple ile açılan hesap şifre sorulmadan silinir', async () => {
    await http().delete('/v1/auth/me').set(auth('oauth')).send({}).expect(204);
    await http().get('/v1/auth/me').set(auth('oauth')).expect(401);
  });
});
