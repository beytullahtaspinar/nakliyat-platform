import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Yönetimden müşteri ve firma açma. Çalışan bir MariaDB/MySQL gerektirir.
describe('Yönetimden hesap açma (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = {
    admin: '+905320001501',
    customer: '+905320001502',
    company: '+905320001503',
    other: '+905320001504',
  };
  const allPhones = Object.values(phones);
  const taxNumber = '7777771501';
  let adminToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  const cleanup = async () => {
    const users = { phone: { in: allPhones } };
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.company.deleteMany({ where: { OR: [{ owner: users }, { taxNumber }] } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Test Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    const login = await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('yönetici müşteri açar; müşteri kendi şifresiyle girer, işlem geçmişe yazılır', async () => {
    const res = await http()
      .post('/v1/admin/users')
      .set(asAdmin())
      .send({ fullName: 'Destek Müşterisi', phone: '0532 000 15 02', email: 'Destek1502@ornek.com', password: 'GucluSifre123', markVerified: true })
      .expect(201);
    expect(res.body).toMatchObject({ role: 'CUSTOMER', phone: phones.customer, email: 'destek1502@ornek.com' });
    expect(res.body.phoneVerifiedAt).not.toBeNull();
    expect(res.body.history[0]).toMatchObject({ action: 'user.create', details: { role: 'CUSTOMER', verified: true } });

    const login = await http().post('/v1/auth/login').send({ phone: phones.customer, password: 'GucluSifre123' }).expect(200);
    expect(login.body.user).toMatchObject({ role: 'CUSTOMER', verified: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: phones.customer } });
    // Kullanım koşullarını kişi kendisi kabul etmedi
    expect(user.termsAcceptedAt).toBeNull();
  });

  it('telefon ya da e-posta başka hesaptaysa açılmaz; doğrulama işaretlenmezse hesap doğrulanmamış kalır', async () => {
    const body = { fullName: 'İkinci', phone: phones.customer, email: 'baska1504@ornek.com', password: 'GucluSifre123' };
    await http().post('/v1/admin/users').set(asAdmin()).send(body).expect(409);
    await http().post('/v1/admin/users').set(asAdmin()).send({ ...body, phone: phones.other, email: 'destek1502@ornek.com' }).expect(409);
    await http().post('/v1/admin/users').set(asAdmin()).send({ ...body, phone: '123' }).expect(400);
    await http().post('/v1/admin/users').set(asAdmin()).send({ ...body, phone: phones.other, password: 'kisa' }).expect(400);

    const res = await http().post('/v1/admin/users').set(asAdmin()).send({ ...body, phone: phones.other }).expect(201);
    expect(res.body.phoneVerifiedAt).toBeNull();
  });

  it('yönetici firmayı yetkilisiyle birlikte açar; firma onay bekler', async () => {
    const res = await http()
      .post('/v1/admin/companies')
      .set(asAdmin())
      .send({
        fullName: 'Firma Yetkilisi',
        phone: phones.company,
        email: 'firma1503@ornek.com',
        password: 'GucluSifre123',
        displayName: 'Deneme Nakliyat',
        legalName: 'Deneme Nakliyat Ltd. Şti.',
        taxNumber,
        cityCode: '34',
        serviceCityCodes: ['06'],
      })
      .expect(201);
    expect(res.body).toMatchObject({ displayName: 'Deneme Nakliyat', verificationStatus: 'PENDING' });
    expect(res.body.serviceCityCodes.sort()).toEqual(['06', '34']);
    expect(res.body.owner).toMatchObject({ fullName: 'Firma Yetkilisi', phone: phones.company });
    expect(res.body.history.map((h: { action: string }) => h.action)).toContain('company.create');

    const login = await http().post('/v1/auth/login').send({ phone: phones.company, password: 'GucluSifre123' }).expect(200);
    expect(login.body.user.role).toBe('COMPANY');
    const own = await http().get('/v1/company/profile').set({ Authorization: `Bearer ${login.body.accessToken}` }).expect(200);
    expect(own.body.id).toBe(res.body.id);
  });

  it('vergi no ya da telefon çakışırsa firma da hesap da açılmaz; uçlar yalnızca yöneticiye açık', async () => {
    const body = {
      fullName: 'Başka Yetkili',
      phone: '+905320001599',
      email: 'baska1599@ornek.com',
      password: 'GucluSifre123',
      displayName: 'Başka',
      legalName: 'Başka Nakliyat',
      taxNumber,
      cityCode: '34',
      serviceCityCodes: ['34'],
    };
    await http().post('/v1/admin/companies').set(asAdmin()).send(body).expect(409);
    await http().post('/v1/admin/companies').set(asAdmin()).send({ ...body, taxNumber: '7777771599', phone: phones.company }).expect(409);
    await http().post('/v1/admin/companies').set(asAdmin()).send({ ...body, taxNumber: '7777771599', cityCode: '99' }).expect(400);
    expect(await prisma.user.count({ where: { phone: '+905320001599' } })).toBe(0);

    const customer = await http().post('/v1/auth/login').send({ phone: phones.customer, password: 'GucluSifre123' }).expect(200);
    const asCustomer = { Authorization: `Bearer ${customer.body.accessToken}` };
    await http().post('/v1/admin/users').set(asCustomer).send({}).expect(403);
    await http().post('/v1/admin/companies').set(asCustomer).send({}).expect(403);
  });
});
