import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { MediaService } from './../src/media/media.service.js';
import { FILE_STORAGE, R2_COOLDOWN_MS, type MediaStorage } from './../src/media/storage.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Hibrit depo: R2 hata verirken dosyalar sunucu diskine kaydedilir, R2 düzelince oraya taşınır.
 * R2 yerine bellekte dosya tutan sahte bir S3 sunucusu kullanılır.
 */
describe('Hibrit dosya deposu: R2 + sunucu diski (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: MediaStorage;
  let uploadDir: string;
  let token: string;
  let requestId: string;
  const phone = '+905320000405';
  const savedEnv = { ...process.env };

  // Sahte R2: r2Down iken her isteğe 403 NotEntitled döner (canlıda görülen hata)
  const objects = new Map<string, { body: Buffer; type: string }>();
  let r2Down = true;
  let r2: Server;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const keyOf = (url: string) => decodeURIComponent(new URL(url, 'http://x').pathname.replace(/^\/kova\//, ''));
  const media = () => prisma.requestMedia.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' } });

  const uploadAndAttach = async (body: Buffer) => {
    const tickets = await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth())
      .send({ files: [{ mimeType: 'image/webp', sizeBytes: body.length }] })
      .expect(201);
    const [ticket] = tickets.body.uploads;
    await http().put(pathOf(ticket.url)).set('Content-Type', 'image/webp').send(body).expect(204);
    await http().post(`/v1/requests/${requestId}/media`).set(auth()).send({ items: [{ key: ticket.key }] }).expect(200);
    return ticket.key as string;
  };

  beforeAll(async () => {
    r2 = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        if (r2Down) return res.writeHead(403).end('<Error><Code>NotEntitled</Code></Error>');
        const key = keyOf(req.url!);
        const object = objects.get(key);
        if (req.method === 'PUT') {
          objects.set(key, { body: Buffer.concat(chunks), type: String(req.headers['content-type']) });
          return res.writeHead(200).end();
        }
        if (req.method === 'DELETE') {
          objects.delete(key);
          return res.writeHead(204).end();
        }
        if (!object) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Type': object.type, 'Content-Length': object.body.length });
        res.end(req.method === 'HEAD' ? undefined : object.body);
      });
    });
    await new Promise<void>((resolve) => r2.listen(0, '127.0.0.1', resolve));

    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-hibrit-'));
    Object.assign(process.env, {
      UPLOAD_DIR: uploadDir,
      R2_ACCOUNT_ID: 'hesap',
      R2_ACCESS_KEY_ID: 'a',
      R2_SECRET_ACCESS_KEY: 'b',
      R2_BUCKET: 'kova',
      R2_ENDPOINT: `http://127.0.0.1:${(r2.address() as AddressInfo).port}`,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(FILE_STORAGE);
    await prisma.user.deleteMany({ where: { phone } });

    const registered = await http()
      .post('/v1/auth/register')
      .send({ role: 'CUSTOMER', fullName: 'Hibrit Test', phone, password: 'GucluSifre123' })
      .expect(201);
    token = registered.body.accessToken;
    const created = await http()
      .post('/v1/requests')
      .set(auth())
      .send({
        fromCityCode: '07',
        fromDistrict: 'muratpasa',
        fromAddress: 'Caferağa Mah. Moda Cad. No:1 D:5',
        fromFloor: 3,
        fromHasElevator: false,
        toCityCode: '07',
        toDistrict: 'konyaalti',
        toAddress: 'Sinanpaşa Mah. No:10 D:2',
        toFloor: 2,
        toHasElevator: true,
        homeType: 'TWO_PLUS_ONE',
        moveDate: new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
      })
      .expect(201);
    requestId = created.body.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.get(DomainEvents).drain();
    await prisma.movingRequest.deleteMany({ where: { customer: { phone } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone } } });
    await prisma.user.deleteMany({ where: { phone } });
    await app.close();
    await new Promise<void>((resolve) => r2.close(() => resolve()));
    await rm(uploadDir, { recursive: true, force: true });
    process.env = savedEnv;
  });

  let diskKey: string;

  it('R2 hata verirse fotoğraf sunucu diskine kaydedilir ve görüntülenir', async () => {
    diskKey = await uploadAndAttach(Buffer.from('disk-fotografi'));
    const [row] = await media();
    expect(row).toMatchObject({ storageKey: diskKey, storage: 'LOCAL' });
    expect(storage.r2Ready()).toBe(false);

    const detail = await http().get(`/v1/requests/${requestId}`).set(auth()).expect(200);
    const image = await http().get(pathOf(detail.body.media[0].url)).expect(200);
    expect(image.body.toString()).toBe('disk-fotografi');
  });

  it('R2 düzelince diskteki dosya R2’ye taşınır, diskten silinir', async () => {
    r2Down = false;
    // R2 hata sonrası bekleme süresi geçmiş gibi
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + R2_COOLDOWN_MS + 1000);
    expect(await app.get(MediaService).moveLocalToR2()).toBe(1);
    vi.restoreAllMocks();

    const [row] = await media();
    expect(row!.storage).toBe('R2');
    expect(objects.get(diskKey)?.body.toString()).toBe('disk-fotografi');
    expect(await storage.local.stat(diskKey)).toBeNull();
    const detail = await http().get(`/v1/requests/${requestId}`).set(auth()).expect(200);
    expect(detail.body.media[0].url).toContain(`/kova/${diskKey}?X-Amz-`);
  });

  it('R2 çalışırken yeni fotoğraf doğrudan R2’ye gider', async () => {
    const key = await uploadAndAttach(Buffer.from('r2-fotografi'));
    const rows = await media();
    expect(rows[1]).toMatchObject({ storageKey: key, storage: 'R2' });
    expect(objects.get(key)?.body.toString()).toBe('r2-fotografi');
    expect(await storage.local.stat(key)).toBeNull();
  });

  it('R2’deki fotoğraf silinince R2’den de silinir', async () => {
    const [row] = await media();
    await http().delete(`/v1/requests/${requestId}/media/${row!.id}`).set(auth()).expect(204);
    expect(objects.has(diskKey)).toBe(false);
  });
});
