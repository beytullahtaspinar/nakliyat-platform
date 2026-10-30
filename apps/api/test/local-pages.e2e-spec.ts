import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Bölge sayfası içeriği: yönetimden yazılır, il/ilçe/güzergâh sayfası okur. Görseller blog kütüphanesinden.
describe('Bölge sayfaları (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phones = { admin: '+905320001801', customer: '+905320001802' };
  const tokens: Record<keyof typeof phones, string> = {} as never;
  const SLUG = 'yozgat-evden-eve-nakliyat';
  const coverKey = `blog/${'e2e10ca1'.repeat(4)}.webp`;
  const imageKey = `blog/${'e2e10ca2'.repeat(4)}.webp`;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });

  const cleanup = async () => {
    await prisma.localPageContent.deleteMany({ where: { slug: { in: [SLUG, 'evden-eve-nakliyat'] } } });
    await prisma.blogMedia.deleteMany({ where: { storageKey: { in: [coverKey, imageKey] } } });
    const users = { phone: { in: Object.values(phones) } };
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const media = (storageKey: string) => ({
    storageKey,
    thumbKey: storageKey.replace('.webp', '.thumb.webp'),
    mimeType: 'image/webp',
    sizeBytes: 1000,
    width: 1600,
    height: 900,
    thumbWidth: 800,
    thumbHeight: 450,
    alt: 'Nakliyat aracı',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await prisma.blogMedia.createMany({ data: [media(coverKey), media(imageKey)] });
    const passwordHash = await bcrypt.hash('GucluSifre123', 4);
    await prisma.user.create({ data: { role: 'ADMIN', fullName: 'Sayfa Admin', phone: phones.admin, passwordHash } });
    await prisma.user.create({ data: { role: 'CUSTOMER', fullName: 'Müşteri', phone: phones.customer, passwordHash } });
    for (const who of ['admin', 'customer'] as const) {
      tokens[who] = (await http().post('/v1/auth/login').send({ phone: phones[who], password: 'GucluSifre123' }).expect(200)).body.accessToken;
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('yönetici sayfa içeriğini yazar, site okur, varsayılana döner', async () => {
    await http().patch(`/v1/admin/local-pages/${SLUG}`).send({ heading: 'X' }).expect(401);
    await http().patch(`/v1/admin/local-pages/${SLUG}`).set(auth('customer')).send({ heading: 'X' }).expect(403);
    await http().patch('/v1/admin/local-pages/olmayan-sayfa').set(auth('admin')).send({ heading: 'X' }).expect(404);
    await http().patch(`/v1/admin/local-pages/${SLUG}`).set(auth('admin')).send({ coverKey: 'blog/yok.webp' }).expect(400);

    expect((await http().get(`/v1/admin/local-pages/${SLUG}`).set(auth('admin')).expect(200)).body).toEqual({});

    const saved = await http()
      .patch(`/v1/admin/local-pages/${SLUG}`)
      .set(auth('admin'))
      .send({
        seoTitle: 'Yozgat Evden Eve Nakliyat Fiyatları',
        heading: 'Yozgat evden eve nakliyat rehberi',
        intro: '  Yozgat için özel giriş metni.  ',
        content: `## Yozgat'ta taşınma\n\n![Araç](/medya/${imageKey})`,
        faq: [{ question: 'Yozgat içi taşınma kaç saat sürer?', answer: 'Ortalama bir 2+1 ev 4-6 saatte taşınır.' }],
        coverKey,
        coverAlt: 'Yozgat taşıma',
        seoDescription: '',
      })
      .expect(200);
    expect(saved.body).toMatchObject({
      slug: SLUG,
      heading: 'Yozgat evden eve nakliyat rehberi',
      intro: 'Yozgat için özel giriş metni.',
      seoDescription: null,
      cover: { src: `/medya/${coverKey}`, alt: 'Yozgat taşıma', width: 1600 },
      faq: [{ question: 'Yozgat içi taşınma kaç saat sürer?' }],
    });
    expect(saved.body.images[`/medya/${imageKey}`]).toMatchObject({ width: 1600, thumb: { width: 800 } });

    const list = await http().get('/v1/local-pages').expect(200);
    expect(list.body.items.find((p: { slug: string }) => p.slug === SLUG)).toMatchObject({ heading: 'Yozgat evden eve nakliyat rehberi' });

    // Kullanılan görsel kütüphaneden silinemez
    const cover = await prisma.blogMedia.findUniqueOrThrow({ where: { storageKey: coverKey } });
    await http().delete(`/v1/admin/blog/media/${cover.id}`).set(auth('admin')).expect(409);

    // Merkez sayfa da düzenlenebilir
    await http().patch('/v1/admin/local-pages/evden-eve-nakliyat').set(auth('admin')).send({ intro: 'Merkez giriş' }).expect(200);

    // Tüm alanlar boşsa varsayılana döner
    await http().patch('/v1/admin/local-pages/evden-eve-nakliyat').set(auth('admin')).send({ intro: '' }).expect(200);
    expect(await prisma.localPageContent.findUnique({ where: { slug: 'evden-eve-nakliyat' } })).toBeNull();

    await http().delete(`/v1/admin/local-pages/${SLUG}`).set(auth('admin')).expect(204);
    expect((await http().get('/v1/local-pages').expect(200)).body.items.map((p: { slug: string }) => p.slug)).not.toContain(SLUG);
    const mine = { entityId: SLUG, actor: { phone: phones.admin }, action: { in: ['local-page.update', 'local-page.reset'] } };
    expect(await prisma.auditLog.count({ where: mine })).toBe(2);
  });
});
