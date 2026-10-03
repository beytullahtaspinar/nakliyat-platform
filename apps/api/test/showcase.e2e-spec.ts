import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

type MediaView = { id: string; kind: string; publicUrl: string; previewUrl: string; hidden: boolean; hiddenReason: string | null; caption: string | null };
type Showcase = {
  description: string | null;
  services: string[];
  foundedYear: number | null;
  logo: MediaView | null;
  photos: MediaView[];
  indexing: { complete: boolean; visiblePhotos: number; descriptionLength: number };
};

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL). Dosyalar geçici klasöre (yerel sürücü) yazılır.
describe('Firma tanıtım sayfası (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const tokens: Record<'company' | 'other' | 'admin', string> = {} as never;
  const phones = { company: '+905320001401', other: '+905320001402', admin: '+905320001403' };
  let companyId: string;
  let otherCompanyId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const image = (size = 2000) => Buffer.alloc(size, 7);
  const longText = 'Ekibimiz 2008 yılından beri evden eve nakliyat yapıyor. '.repeat(7);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const register = async (phone: string) =>
    (
      await http()
        .post('/v1/auth/register')
        .send({ role: 'COMPANY', fullName: 'Tanıtım Test', phone, password: 'GucluSifre123' })
        .expect(201)
    ).body.accessToken as string;

  /** Logo ya da fotoğraf (büyük + önizleme) yükleyip sayfaya ekler */
  const addMedia = async (kind: 'LOGO' | 'PHOTO', who: 'company' | 'other' = 'company', caption?: string) => {
    const body = image();
    const thumb = image(500);
    const ticket = await http()
      .post('/v1/company/showcase/uploads')
      .set(auth(who))
      .send({
        kind,
        file: { mimeType: 'image/webp', sizeBytes: body.length },
        ...(kind === 'PHOTO' && { thumb: { mimeType: 'image/webp', sizeBytes: thumb.length } }),
      })
      .expect(201);
    await http().put(pathOf(ticket.body.file.url)).set('Content-Type', 'image/webp').send(body).expect(204);
    if (kind === 'PHOTO') {
      await http().put(pathOf(ticket.body.thumb.url)).set('Content-Type', 'image/webp').send(thumb).expect(204);
    }
    const res = await http()
      .post('/v1/company/showcase/media')
      .set(auth(who))
      .send({ kind, key: ticket.body.file.key, thumbKey: ticket.body.thumb?.key, width: 1600, height: 1200, caption })
      .expect(200);
    return res.body as Showcase;
  };

  /** Herkese açık görsel adresi (/medya/firmalar/...) → API'deki karşılığı */
  const publicFile = (publicUrl: string) => http().get(publicUrl.replace(/^\/medya\//, '/v1/public-media/'));
  const profile = async () => (await http().get(`/v1/companies/${companyId}`).expect(200)).body;

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-tanitim-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.LOCAL_UPLOAD_QUOTA_MB = '50';
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    tokens.company = await register(phones.company);
    tokens.other = await register(phones.other);
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const create = (who: 'company' | 'other', taxNumber: string, cityCode: string, serviceCityCodes: string[]) =>
      http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: 'Tanıtım Nakliyat Ltd.', displayName: 'Tanıtım Nakliyat', taxNumber, cityCode, serviceCityCodes })
        .expect(201);
    companyId = (await create('company', '7700000001', '35', ['35', '06'])).body.id;
    otherCompanyId = (await create('other', '7700000002', '35', ['35'])).body.id;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('tanıtım yazısı, hizmetler ve rakamlar kaydedilir; iletişim bilgisi kabul edilmez', async () => {
    const saved = await http()
      .patch('/v1/company/showcase')
      .set(auth('company'))
      .send({ description: 'Kısa tanıtım', services: ['MONTAJ', 'EVDEN_EVE', 'YOK'], foundedYear: 2008 })
      .expect(400);
    expect(JSON.stringify(saved.body.message)).toContain('services');

    const ok = await http()
      .patch('/v1/company/showcase')
      .set(auth('company'))
      .send({ description: 'Kısa tanıtım', services: ['MONTAJ', 'EVDEN_EVE'], foundedYear: 2008, fleetSize: 4, staffSize: '' })
      .expect(200);
    // Hizmetler sabit sırada saklanır
    expect(ok.body).toMatchObject({ description: 'Kısa tanıtım', services: ['EVDEN_EVE', 'MONTAJ'], foundedYear: 2008, fleetSize: 4, staffSize: null });

    for (const text of ['Bizi arayın: 0532 123 45 67', 'Yazın: info@ornek.com', 'Sitemiz www.ornek-nakliyat.com.tr']) {
      const res = await http().patch('/v1/company/showcase').set(auth('company')).send({ description: text }).expect(400);
      expect(res.body.message).toContain('içeremez');
    }
    // Yıl ve "7/24" gibi rakamlar telefon sayılmaz
    await http()
      .patch('/v1/company/showcase')
      .set(auth('company'))
      .send({ description: '2008 yılından beri 7/24 hizmet, 1500 taşıma, 35 il.' })
      .expect(200);
    await http().patch('/v1/company/showcase').set(auth('company')).send({ foundedYear: 2999 }).expect(400);
  });

  it('logo ve fotoğraf eklenir, yeni logo eskisinin yerini alır, başka firmanın dosyası eklenemez', async () => {
    const first = await addMedia('LOGO');
    const second = await addMedia('LOGO');
    expect(second.logo!.id).not.toBe(first.logo!.id);
    expect(await prisma.companyMedia.count({ where: { companyId, kind: 'LOGO' } })).toBe(1);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.logoUrl).toBe(second.logo!.publicUrl);

    const withPhoto = await addMedia('PHOTO', 'company', 'Kamyonumuz');
    expect(withPhoto.photos).toHaveLength(1);
    expect(withPhoto.photos[0].caption).toBe('Kamyonumuz');

    // Fotoğraf önizlemesiz eklenemez
    await http()
      .post('/v1/company/showcase/uploads')
      .set(auth('company'))
      .send({ kind: 'PHOTO', file: { mimeType: 'image/webp', sizeBytes: 100 } })
      .expect(400);
    // Başka firmanın anahtarı
    const ticket = await http()
      .post('/v1/company/showcase/uploads')
      .set(auth('other'))
      .send({ kind: 'LOGO', file: { mimeType: 'image/webp', sizeBytes: 100 } })
      .expect(201);
    await http().post('/v1/company/showcase/media').set(auth('company')).send({ kind: 'LOGO', key: ticket.body.file.key }).expect(400);
    // Görsel açıklamasında da iletişim bilgisi olamaz
    await http()
      .patch(`/v1/company/showcase/media/${withPhoto.photos[0].id}`)
      .set(auth('company'))
      .send({ caption: 'Ara 05321234567' })
      .expect(400);
  });

  it('görseller yalnızca firma onaylanınca herkese açık adresten gelir', async () => {
    const showcase = (await http().get('/v1/company/showcase').set(auth('company')).expect(200)).body as Showcase;
    // Panel önizlemesi imzalı adresten: onaysız firma da kendi görselini görür
    await http().get(pathOf(showcase.logo!.previewUrl)).expect(200);
    await publicFile(showcase.logo!.publicUrl).expect(404);
    await http().get(`/v1/companies/${companyId}`).expect(404);

    await addApprovedDocuments(prisma, [companyId, otherCompanyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
    await http().post(`/v1/admin/companies/${otherCompanyId}/verify`).set(auth('admin')).expect(200);

    const logo = await publicFile(showcase.logo!.publicUrl).expect(200);
    expect(logo.headers['content-type']).toBe('image/webp');
    expect(logo.headers['cache-control']).toContain('immutable');
    expect(logo.body.length).toBe(2000);
    // Önizleme (küçük dosya) da ayrı adresten gelir
    const p = await profile();
    expect(p.photos).toHaveLength(1);
    expect((await http().get(p.photos[0].thumbUrl.replace(/^\/medya\//, '/v1/public-media/')).expect(200)).body.length).toBe(500);
    expect(p).toMatchObject({ logoUrl: showcase.logo!.publicUrl, services: ['EVDEN_EVE', 'MONTAJ'], foundedYear: 2008, fleetSize: 4 });
    // Uydurma ya da yol geçişli adres
    await http().get(`/v1/public-media/firmalar/${companyId}/${'0'.repeat(32)}.webp`).expect(404);
    await http().get(`/v1/public-media/firmalar/${companyId}/..%2F..%2Fx.webp`).expect(404);
  });

  it('yorumsuz firma: 300+ karakter tanıtım ve 2 fotoğrafla dizine açılır, yönetici gizleyince kapanır', async () => {
    expect((await profile()).indexable).toBe(false);
    let s = (await http().patch('/v1/company/showcase').set(auth('company')).send({ description: longText }).expect(200)).body as Showcase;
    expect(s.indexing).toMatchObject({ complete: false, visiblePhotos: 1 });
    s = await addMedia('PHOTO');
    expect(s.indexing.complete).toBe(true);
    expect((await profile()).indexable).toBe(true);

    // Site haritası: dizine açık firmalar; il filtresi merkez ya da hizmet iline bakar
    const indexable = await http().get('/v1/companies?indexable=true&limit=1000').expect(200);
    const ids = indexable.body.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(companyId);
    expect(ids).not.toContain(otherCompanyId);
    const ankara = (await http().get('/v1/companies?city=06&limit=100').expect(200)).body.items.map((c: { id: string }) => c.id);
    expect(ankara).toContain(companyId);
    expect(ankara).not.toContain(otherCompanyId);
    const route = (await http().get('/v1/companies?city=35&toCity=06&limit=100').expect(200)).body.items.map((c: { id: string }) => c.id);
    expect(route).toEqual(expect.arrayContaining([companyId]));
    expect(route).not.toContain(otherCompanyId);
    const listed = indexable.body.items.find((c: { id: string }) => c.id === companyId);
    expect(listed).toMatchObject({ serviceCityCodes: ['06', '35'], logoUrl: expect.stringMatching(/^\/medya\/firmalar\//) });

    // Yönetici fotoğrafı gizler: herkese açık adresten kalkar, firma gerekçeyi görür, sayfa dizinden çıkar
    const photo = s.photos[0];
    await http().post(`/v1/admin/companies/${companyId}/media/${photo.id}/hide`).set(auth('admin')).send({ reason: 'Başka firmanın aracı' }).expect(200);
    await publicFile(photo.publicUrl).expect(404);
    const own = (await http().get('/v1/company/showcase').set(auth('company')).expect(200)).body as Showcase;
    expect(own.photos.find((m) => m.id === photo.id)).toMatchObject({ hidden: true, hiddenReason: 'Başka firmanın aracı' });
    expect(own.indexing.complete).toBe(false);
    expect((await profile()).photos).toHaveLength(1);
    expect((await profile()).indexable).toBe(false);

    // Logo gizlenince firmanın logo adresi de boşalır, geri açılınca döner
    await http().post(`/v1/admin/companies/${companyId}/media/${own.logo!.id}/hide`).set(auth('admin')).send({ reason: 'Uygunsuz' }).expect(200);
    expect((await profile()).logoUrl).toBeNull();
    await http().post(`/v1/admin/companies/${companyId}/media/${own.logo!.id}/unhide`).set(auth('admin')).expect(200);
    expect((await profile()).logoUrl).toBe(own.logo!.publicUrl);

    const detail = (await http().get(`/v1/admin/companies/${companyId}`).set(auth('admin')).expect(200)).body;
    expect(detail.media.filter((m: MediaView) => m.hidden)).toHaveLength(1);
  });

  it('firma görselini silince dosya da silinir', async () => {
    const own = (await http().get('/v1/company/showcase').set(auth('company')).expect(200)).body as Showcase;
    const photo = own.photos.find((m) => !m.hidden)!;
    const after = (await http().delete(`/v1/company/showcase/media/${photo.id}`).set(auth('company')).expect(200)).body as Showcase;
    expect(after.photos.find((m) => m.id === photo.id)).toBeUndefined();
    await publicFile(photo.publicUrl).expect(404);
    await http().delete(`/v1/company/showcase/media/${photo.id}`).set(auth('company')).expect(404);
  });
});
