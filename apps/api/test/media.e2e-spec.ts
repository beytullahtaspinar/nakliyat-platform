import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { markVerified } from './helpers.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL). Dosyalar geçici klasöre (yerel sürücü) yazılır.
describe('Talep fotoğraf ve videoları (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const tokens: Record<'customer' | 'other' | 'company' | 'farCompany', string> = {} as never;
  const phones = ['+905320000401', '+905320000402', '+905320000403', '+905320000404'];
  let requestId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  /** API'nin verdiği mutlak adresten yol kısmı (supertest kendi sunucusuna gider) */
  const pathOf = (url: string) => new URL(url).pathname;
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const cleanup = async () => {
    const users = { phone: { in: phones } };
    await prisma.movingRequest.deleteMany({ where: { customer: users } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const register = async (phone: string, role: 'CUSTOMER' | 'COMPANY') => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ role, fullName: 'Medya Test', phone, password: 'GucluSifre123' })
      .expect(201);
    return res.body.accessToken as string;
  };

  const upload = async (mimeType: string, body: Buffer) => {
    const tickets = await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth('customer'))
      .send({ files: [{ mimeType, sizeBytes: body.length }] })
      .expect(201);
    const [ticket] = tickets.body.uploads;
    await http().put(pathOf(ticket.url)).set('Content-Type', mimeType).send(body).expect(204);
    return ticket.key as string;
  };

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-medya-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.LOCAL_UPLOAD_QUOTA_MB = '50';
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    tokens.customer = await register(phones[0]!, 'CUSTOMER');
    tokens.other = await register(phones[1]!, 'CUSTOMER');
    tokens.company = await register(phones[2]!, 'COMPANY');
    tokens.farCompany = await register(phones[3]!, 'COMPANY');
    await markVerified(prisma, phones);
    const profile = (cityCode: string, taxNumber: string) => ({
      legalName: 'Medya Nakliyat Ltd.',
      displayName: 'Medya Nakliyat',
      taxNumber,
      cityCode,
      serviceCityCodes: [cityCode],
    });
    await http().post('/v1/company/profile').set(auth('company')).send(profile('07', '8800000001')).expect(201);
    await http().post('/v1/company/profile').set(auth('farCompany')).send(profile('42', '8800000002')).expect(201);

    const created = await http()
      .post('/v1/requests')
      .set(auth('customer'))
      .send({
        // Antalya: diğer e2e testlerinin şehirleriyle çakışmasın (firma talep listeleri paralel çalışıyor)
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
        moveDate: inDays(15),
      })
      .expect(201);
    requestId = created.body.id;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const photo = Buffer.from('RIFF....WEBPVP8 sahte-fotograf-verisi');
  let photoKey: string;

  it('müşteri fotoğraf yükler ve talebe bağlar', async () => {
    photoKey = await upload('image/webp', photo);
    expect(photoKey).toMatch(new RegExp(`^talepler/${requestId}/[a-f0-9]{32}\\.webp$`));
    const res = await http()
      .post(`/v1/requests/${requestId}/media`)
      .set(auth('customer'))
      .send({ items: [{ key: photoKey, width: 1600, height: 1200 }] })
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ type: 'PHOTO', mimeType: 'image/webp', sizeBytes: photo.length, width: 1600 });
  });

  it('aynı dosyayı iki kez bağlamak kopya oluşturmaz', async () => {
    const res = await http()
      .post(`/v1/requests/${requestId}/media`)
      .set(auth('customer'))
      .send({ items: [{ key: photoKey }] })
      .expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('talep ayrıntısında imzalı adresle görüntülenir', async () => {
    const res = await http().get(`/v1/requests/${requestId}`).set(auth('customer')).expect(200);
    const [media] = res.body.media;
    const file = await http().get(pathOf(media.url)).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(file.headers['cache-control']).toContain('private');
    expect(Buffer.from(file.body).equals(photo)).toBe(true);
  });

  it('bozuk veya başka işlem için verilmiş belirteçle dosya açılmaz', async () => {
    const res = await http().get(`/v1/requests/${requestId}`).set(auth('customer')).expect(200);
    const url = pathOf(res.body.media[0].url);
    await http().get(`${url.slice(0, -2)}xx`).expect(404);
    await http().get('/v1/files/bozuk').expect(404);
  });

  it('hizmet bölgesindeki firma dosyaları görür, bölge dışındaki talebi göremez', async () => {
    const res = await http().get(`/v1/company/requests/${requestId}`).set(auth('company')).expect(200);
    expect(res.body.media).toHaveLength(1);
    await http().get(`/v1/company/requests/${requestId}`).set(auth('farCompany')).expect(404);
  });

  it('başka müşteri ve firma yükleme adresi alamaz', async () => {
    const body = { files: [{ mimeType: 'image/webp', sizeBytes: 100 }] };
    await http().post(`/v1/requests/${requestId}/media/uploads`).set(auth('other')).send(body).expect(404);
    await http().post(`/v1/requests/${requestId}/media/uploads`).set(auth('company')).send(body).expect(403);
  });

  it('desteklenmeyen tür ve sınırı aşan boyut reddedilir', async () => {
    const send = (files: unknown[]) =>
      http().post(`/v1/requests/${requestId}/media/uploads`).set(auth('customer')).send({ files });
    await send([{ mimeType: 'image/svg+xml', sizeBytes: 100 }]).expect(400);
    await send([{ mimeType: 'image/webp', sizeBytes: 4 * 1024 * 1024 }]).expect(400);
    await send([{ mimeType: 'video/mp4', sizeBytes: 31 * 1024 * 1024 }]).expect(400);
  });

  it('toplam boyut sınırı dolunca yükleme durur', async () => {
    // Testte sınır 50 MB: iki 29 MB video sığmaz
    const video = { mimeType: 'video/mp4', sizeBytes: 29 * 1024 * 1024 };
    const res = await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth('customer'))
      .send({ files: [video, video] })
      .expect(409);
    expect(res.body.message).toContain('fotoğrafsız');
  });

  it('en fazla 2 video eklenebilir', async () => {
    const video = { mimeType: 'video/mp4', sizeBytes: 1000 };
    await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth('customer'))
      .send({ files: [video, video, video] })
      .expect(400);
  });

  it('bildirilenden farklı boyut veya tür yüklenemez', async () => {
    const tickets = await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth('customer'))
      .send({ files: [{ mimeType: 'image/jpeg', sizeBytes: 10 }] })
      .expect(201);
    const url = pathOf(tickets.body.uploads[0].url);
    await http().put(url).set('Content-Type', 'image/jpeg').send(Buffer.alloc(20)).expect(400);
    await http().put(url).set('Content-Type', 'image/webp').send(Buffer.alloc(10)).expect(400);
    // Yüklenmemiş dosya bağlanamaz
    await http()
      .post(`/v1/requests/${requestId}/media`)
      .set(auth('customer'))
      .send({ items: [{ key: tickets.body.uploads[0].key }] })
      .expect(400);
  });

  it('başka talebe ait anahtar bağlanamaz', async () => {
    await http()
      .post(`/v1/requests/${requestId}/media`)
      .set(auth('customer'))
      .send({ items: [{ key: photoKey.replace(requestId, 'baskatalep1234567890') }] })
      .expect(400);
  });

  it('video yüklenir, sonra müşteri siler', async () => {
    const key = await upload('video/mp4', Buffer.from('....ftypisom sahte-video'));
    const res = await http()
      .post(`/v1/requests/${requestId}/media`)
      .set(auth('customer'))
      .send({ items: [{ key, durationSec: 42, width: 1280, height: 720 }] })
      .expect(200);
    const video = res.body.find((m: { type: string }) => m.type === 'VIDEO');
    expect(video).toMatchObject({ mimeType: 'video/mp4', durationSec: 42 });

    await http().delete(`/v1/requests/${requestId}/media/${video.id}`).set(auth('other')).expect(404);
    await http().delete(`/v1/requests/${requestId}/media/${video.id}`).set(auth('customer')).expect(204);
    await http().get(pathOf(video.url)).expect(404);
  });

  it('iptal edilen talebe dosya eklenemez', async () => {
    await http().post(`/v1/requests/${requestId}/cancel`).set(auth('customer')).expect(200);
    await http()
      .post(`/v1/requests/${requestId}/media/uploads`)
      .set(auth('customer'))
      .send({ files: [{ mimeType: 'image/webp', sizeBytes: 100 }] })
      .expect(409);
  });
});
