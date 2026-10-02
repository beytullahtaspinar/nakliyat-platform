import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { markVerified } from './helpers.js';

// Haritadaki iki işaret arası yol, sahte bir OpenRouteService ile. Çalışan bir MariaDB/MySQL gerektirir.
describe('Harita işaretleri ve yol mesafesi (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ors: Server;
  let token: string;
  const phone = '+905320000301';
  const calls: { auth?: string; body: unknown }[] = [];
  let orsDown = false;

  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const body = () => ({
    fromCityCode: '34', fromDistrict: 'kadikoy', fromAddress: 'Moda Cad. No:1 D:5', fromFloor: 1, fromHasElevator: true,
    fromLat: 40.9862, fromLng: 29.0254,
    toCityCode: '34', toDistrict: 'besiktas', toAddress: 'Barbaros Blv. No:3 D:4', toFloor: 2, toHasElevator: true,
    toLat: 41.0422, toLng: 29.0083,
    homeType: 'TWO_PLUS_ONE', moveDate: inDays(15),
  });
  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ors = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        calls.push({ auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString()) });
        if (orsDown) return res.writeHead(503).end('bakımda');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ routes: [{ summary: { distance: 14_420, duration: 1_870 } }] }));
      });
    });
    await new Promise<void>((resolve) => ors.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, {
      ORS_API_KEY: 'test-anahtari',
      ORS_BASE_URL: `http://127.0.0.1:${(ors.address() as AddressInfo).port}`,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.movingRequest.deleteMany({ where: { customer: { phone } } });
    await prisma.user.deleteMany({ where: { phone } });
    const res = await http()
      .post('/v1/auth/register')
      .send({ role: 'CUSTOMER', fullName: 'Harita Test', phone, password: 'GucluSifre123' })
      .expect(201);
    token = res.body.accessToken;
    await markVerified(prisma, [phone]);
  });

  afterAll(async () => {
    delete process.env.ORS_API_KEY;
    delete process.env.ORS_BASE_URL;
    await app.get(DomainEvents).drain();
    await prisma.movingRequest.deleteMany({ where: { customer: { phone } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone } } });
    await prisma.user.deleteMany({ where: { phone } });
    await app.close();
    await new Promise((resolve) => ors.close(resolve));
  });

  let requestId: string;

  it('iki nokta işaretlenince yol bir kez hesaplanıp kaydedilir', async () => {
    const res = await http().post('/v1/requests').set(auth()).send(body()).expect(201);
    requestId = res.body.id;
    expect(res.body).toMatchObject({ routeKm: 14, routeMinutes: 31, distanceKm: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ auth: 'test-anahtari', body: { coordinates: [[29.0254, 40.9862], [29.0083, 41.0422]] } });

    // Okurken yeniden hesaplanmaz
    await http().get(`/v1/requests/${requestId}`).set(auth()).expect(200);
    expect(calls).toHaveLength(1);
  });

  it('adres değişip yeni işaret gelmezse eski işaret ve yol silinir', async () => {
    const res = await http()
      .patch(`/v1/requests/${requestId}`)
      .set(auth())
      .send({ toDistrict: 'sisli', toAddress: 'Halaskargazi Cad. No:5' })
      .expect(200);
    expect(res.body).toMatchObject({ toLat: null, toLng: null, routeKm: null, routeMinutes: null, fromLat: 40.9862 });
    expect(calls).toHaveLength(1);
  });

  it('yalnızca enlem gönderilirse reddedilir', async () => {
    const { toLng: _toLng, ...rest } = body();
    await http().post('/v1/requests').set(auth()).send(rest).expect(400);
  });

  it('Türkiye dışındaki işaret reddedilir', async () => {
    await http().post('/v1/requests').set(auth()).send({ ...body(), toLat: 48.85, toLng: 2.35 }).expect(400);
  });

  it('yol servisi çalışmazsa talep yine açılır', async () => {
    orsDown = true;
    const res = await http().post('/v1/requests').set(auth()).send(body()).expect(201);
    expect(res.body).toMatchObject({ status: 'OPEN', routeKm: null, fromLat: 40.9862 });
  });
});
