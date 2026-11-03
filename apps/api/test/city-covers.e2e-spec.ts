import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { FILE_STORAGE, type MediaStorage } from './../src/media/storage.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { retryOnConflict } from './helpers.js';

// Hazır il kapakları: lisanslı fotoğraflar atfıyla yüklenir; elle seçilmiş kapağa dokunulmaz, ikinci çalıştırma bir şey eklemez.
describe('Hazır il kapakları (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir: string;
  const phones = { admin: '+905320001901', customer: '+905320001902' };
  const tokens: Record<keyof typeof phones, string> = {} as never;
  const MANUAL = 'kilis-evden-eve-nakliyat';
  const TEXT_ONLY = 'bartin-evden-eve-nakliyat';
  const FRESH = 'ardahan-evden-eve-nakliyat';
  const SLUGS = [MANUAL, TEXT_ONLY, FRESH];
  const manualKey = `blog/${'e2ec17a1'.repeat(4)}.webp`;
  const source = (slug: string) => `https://commons.wikimedia.org/wiki/File:E2e-${slug}.jpg`;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });

  const cleanup = async () => {
    await prisma.localPageContent.deleteMany({ where: { slug: { in: SLUGS } } });
    const imported = await prisma.blogMedia.findMany({ where: { creditSourceUrl: { in: SLUGS.map(source) } } });
    const storage = app.get<MediaStorage>(FILE_STORAGE);
    for (const m of imported) {
      await storage.delete(m.storageKey, m.storage);
      await storage.delete(m.thumbKey, m.thumbStorage);
    }
    await prisma.blogMedia.deleteMany({ where: { OR: [{ storageKey: manualKey }, { id: { in: imported.map((m) => m.id) } }] } });
    const users = { phone: { in: Object.values(phones) } };
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'il-kapaklari-'));
    process.env.CITY_COVERS_DIR = dir;
    // Yüklenen dosyalar geçici klasöre (yerel sürücü) yazılır
    process.env.UPLOAD_DIR = join(dir, 'yuklemeler');
    delete process.env.R2_ACCOUNT_ID;
    const entries = SLUGS.map((slug) => ({
      slug,
      file: `${slug}.webp`,
      thumb: `${slug}-800.webp`,
      width: 1600,
      height: 1067,
      thumbWidth: 800,
      thumbHeight: 533,
      alt: `${slug} şehir manzarası`,
      credit: { author: 'Örnek Fotoğrafçı', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: source(slug) },
    }));
    // Klasörde manifestte olmayan ya da atıfsız kayıt yok sayılır
    entries.push({ ...entries[0], slug: 'olmayan-sayfa' });
    entries.push({ ...entries[0], slug: 'yozgat-evden-eve-nakliyat', credit: { ...entries[0].credit, author: '' } });
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(entries));
    for (const slug of SLUGS) {
      await writeFile(join(dir, `${slug}.webp`), Buffer.alloc(2000, 1));
      await writeFile(join(dir, `${slug}-800.webp`), Buffer.alloc(500, 1));
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await retryOnConflict(cleanup);
    await prisma.blogMedia.create({
      data: {
        storageKey: manualKey,
        thumbKey: manualKey.replace('.webp', '.thumb.webp'),
        mimeType: 'image/webp',
        sizeBytes: 1000,
        width: 1600,
        height: 900,
        thumbWidth: 800,
        thumbHeight: 450,
        alt: 'Elle seçilen',
      },
    });
    await prisma.localPageContent.create({ data: { slug: MANUAL, coverKey: manualKey, coverAlt: 'Elle seçilen' } });
    await prisma.localPageContent.create({ data: { slug: TEXT_ONLY, intro: 'Bartın için özel giriş.' } });
    const passwordHash = await bcrypt.hash('GucluSifre123', 4);
    await prisma.user.create({ data: { role: 'ADMIN', fullName: 'Kapak Admin', phone: phones.admin, passwordHash } });
    await prisma.user.create({ data: { role: 'CUSTOMER', fullName: 'Müşteri', phone: phones.customer, passwordHash } });
    for (const who of ['admin', 'customer'] as const) {
      tokens[who] = (await http().post('/v1/auth/login').send({ phone: phones[who], password: 'GucluSifre123' }).expect(200)).body.accessToken;
    }
  });

  afterAll(async () => {
    await retryOnConflict(cleanup);
    await app.close();
    delete process.env.CITY_COVERS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('kapağı olmayan il sayfalarına atıflı görsel ekler, elle seçilene dokunmaz', async () => {
    await http().post('/v1/admin/local-pages/city-covers').expect(401);
    await http().post('/v1/admin/local-pages/city-covers').set(auth('customer')).expect(403);

    const before = await http().get('/v1/admin/local-pages/city-covers').set(auth('admin')).expect(200);
    expect(before.body).toEqual({ total: 3, available: 2 });

    const result = await http().post('/v1/admin/local-pages/city-covers').set(auth('admin')).expect(201);
    expect(result.body.added.sort()).toEqual([FRESH, TEXT_ONLY].sort());

    const pages = (await http().get('/v1/local-pages').expect(200)).body.items as {
      slug: string;
      intro: string | null;
      cover: { alt: string; credit: unknown } | null;
    }[];
    const page = (slug: string) => pages.find((p) => p.slug === slug)!;
    expect(page(MANUAL).cover).toMatchObject({ alt: 'Elle seçilen', credit: null });
    expect(page(TEXT_ONLY).intro).toBe('Bartın için özel giriş.');
    expect(page(FRESH).cover).toMatchObject({
      alt: `${FRESH} şehir manzarası`,
      credit: {
        author: 'Örnek Fotoğrafçı',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: source(FRESH),
      },
    });

    // İkinci çalıştırma: eklenecek kalmadı
    expect((await http().get('/v1/admin/local-pages/city-covers').set(auth('admin')).expect(200)).body).toEqual({ total: 3, available: 0 });
    expect((await http().post('/v1/admin/local-pages/city-covers').set(auth('admin')).expect(201)).body.added).toEqual([]);

    // Kapak kaldırılıp tekrar eklenirse aynı görsel yeniden kullanılır, ikinci kopya yüklenmez
    await prisma.localPageContent.update({ where: { slug: FRESH }, data: { coverKey: null, coverAlt: null } });
    await http().post('/v1/admin/local-pages/city-covers').set(auth('admin')).expect(201);
    expect(await prisma.blogMedia.count({ where: { creditSourceUrl: source(FRESH) } })).toBe(1);
  });
});
