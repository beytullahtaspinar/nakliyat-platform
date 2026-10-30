import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { retryOnConflict } from './helpers.js';

// Blog: yönetimden yazı, kategori, yazar ve görsel; sitenin okuduğu herkese açık uçlar.
// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL). Görseller geçici klasöre (yerel sürücü) yazılır.
describe('Blog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const phones = { admin: '+905320001701', customer: '+905320001702' };
  const tokens: Record<keyof typeof phones, string> = {} as never;
  const PREFIX = 'e2e-blog';
  let categoryId: string;
  let authorId: string;
  let postId: string;
  let coverKey: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const content = (extra = '') =>
    `Taşınmadan dört hafta önce planlamaya başlamalısın.\n\n## Dört hafta önce\n\n${'Nakliyat firmalarından teklif al ve tarihi kesinleştir. '.repeat(12)}\n\n## Taşınma günü\n\n- Kolileri say\n- Sayaçları oku\n${extra}`;
  const post = (overrides: Record<string, unknown> = {}) => ({
    title: 'E2E taşınma kontrol listesi',
    slug: `${PREFIX}-kontrol-listesi`,
    excerpt: 'Taşınmadan önceki dört haftada yapılacakları adım adım anlatan kontrol listesi ve ipuçları.',
    summary: 'En az dört hafta önce başla: teklif al, kolileri topla, abonelikleri taşı.',
    content: content(),
    faq: [{ question: 'Taşınmaya ne zaman hazırlanmalıyım?', answer: 'En az dört hafta önce başlamanı öneririz.' }],
    status: 'PUBLISHED',
    categoryId,
    authorId,
    ...overrides,
  });

  const cleanup = async () => {
    await prisma.blogPost.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.blogCategory.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.blogAuthor.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    const users = { phone: { in: Object.values(phones) } };
    const actors = await prisma.user.findMany({ where: users, select: { id: true } });
    const mediaIds = (await prisma.auditLog.findMany({
      where: { actorId: { in: actors.map((a) => a.id) }, entityType: 'BlogMedia' },
      select: { entityId: true },
    })).map((l) => l.entityId);
    await prisma.blogMedia.deleteMany({ where: { id: { in: mediaIds } } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-blog-'));
    process.env.UPLOAD_DIR = uploadDir;
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await retryOnConflict(cleanup);
    const passwordHash = await bcrypt.hash('GucluSifre123', 4);
    await prisma.user.create({ data: { role: 'ADMIN', fullName: 'Blog Admin', phone: phones.admin, passwordHash } });
    await prisma.user.create({ data: { role: 'CUSTOMER', fullName: 'Müşteri', phone: phones.customer, passwordHash } });
    for (const who of ['admin', 'customer'] as const) {
      tokens[who] = (await http().post('/v1/auth/login').send({ phone: phones[who], password: 'GucluSifre123' }).expect(200)).body.accessToken;
    }
  });

  afterAll(async () => {
    await retryOnConflict(cleanup);
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('yönetim uçları yalnızca yöneticiye açık', async () => {
    await http().get('/v1/admin/blog/posts').expect(401);
    await http().get('/v1/admin/blog/posts').set(auth('customer')).expect(403);
    await http().get('/v1/admin/blog/posts').set(auth('admin')).expect(200);
  });

  it('kategori ve yazar açılır; kısa ad addan Türkçe karakterlerle üretilir', async () => {
    const categories = await http()
      .post('/v1/admin/blog/categories')
      .set(auth('admin'))
      .send({ name: 'Taşınma Rehberi', slug: `${PREFIX}-tasinma-rehberi`, description: 'Taşınma öncesi ve sonrası yapılacaklar.' })
      .expect(201);
    categoryId = categories.body.find((c: { slug: string }) => c.slug === `${PREFIX}-tasinma-rehberi`).id;
    // Aynı kısa ad ikinci kez kullanılamaz
    await http().post('/v1/admin/blog/categories').set(auth('admin')).send({ name: 'Başka', slug: `${PREFIX}-tasinma-rehberi` }).expect(409);

    const authors = await http()
      .post('/v1/admin/blog/authors')
      .set(auth('admin'))
      .send({ name: `${PREFIX} Elif Şahin`, jobTitle: 'Nakliyat editörü', bio: '10 yıllık sektör deneyimi.', sameAs: ['https://www.linkedin.com/in/ornek'] })
      .expect(201);
    const author = authors.body.find((a: { slug: string }) => a.slug === `${PREFIX}-elif-sahin`);
    expect(author).toMatchObject({ name: `${PREFIX} Elif Şahin`, jobTitle: 'Nakliyat editörü', sameAs: ['https://www.linkedin.com/in/ornek'] });
    authorId = author.id;
    await http().post('/v1/admin/blog/authors').set(auth('admin')).send({ name: 'Ad', sameAs: ['javascript:alert(1)'] }).expect(400);
  });

  it('kapak görseli (büyük + önizleme) yüklenir ve herkese açık adresten gelir', async () => {
    const big = Buffer.alloc(3000, 7);
    const small = Buffer.alloc(800, 3);
    const ticket = await http()
      .post('/v1/admin/blog/media/uploads')
      .set(auth('admin'))
      .send({ file: { mimeType: 'image/webp', sizeBytes: big.length }, thumb: { mimeType: 'image/webp', sizeBytes: small.length } })
      .expect(201);
    expect(ticket.body.file.key).toMatch(/^blog\/[a-f0-9]{32}\.webp$/);
    await http().put(pathOf(ticket.body.file.url)).set('Content-Type', 'image/webp').send(big).expect(204);
    await http().put(pathOf(ticket.body.thumb.url)).set('Content-Type', 'image/webp').send(small).expect(204);
    const media = await http()
      .post('/v1/admin/blog/media')
      .set(auth('admin'))
      .send({ key: ticket.body.file.key, thumbKey: ticket.body.thumb.key, size: { width: 1600, height: 900 }, thumbSize: { width: 800, height: 450 }, alt: 'Koliler' })
      .expect(201);
    expect(media.body).toMatchObject({ src: `/medya/${ticket.body.file.key}`, width: 1600, thumb: { width: 800 }, alt: 'Koliler' });
    coverKey = media.body.key;

    const file = await http().get(media.body.src.replace(/^\/medya\//, '/v1/public-media/')).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.body.length).toBe(3000);
    expect((await http().get(media.body.thumb.src.replace(/^\/medya\//, '/v1/public-media/')).expect(200)).body.length).toBe(800);
    await http().get(`/v1/public-media/blog/${'0'.repeat(32)}.webp`).expect(404);
    await http().get('/v1/public-media/blog/..%2F..%2Fx.webp').expect(404);
  });

  it('yayınlama kuralları: kısa içerik, H1 ve alt metinsiz kapak kabul edilmez; taslak serbest', async () => {
    const short = await http().post('/v1/admin/blog/posts').set(auth('admin')).send(post({ content: 'Kısa' })).expect(400);
    expect(short.body.message).toContain('içerik en az');
    const h1 = await http().post('/v1/admin/blog/posts').set(auth('admin')).send(post({ content: `# Başlık\n\n${content()}` })).expect(400);
    expect(h1.body.message).toContain('H1');
    const alt = await http().post('/v1/admin/blog/posts').set(auth('admin')).send(post({ coverKey })).expect(400);
    expect(alt.body.message).toContain('alt metin');

    const draft = await http()
      .post('/v1/admin/blog/posts')
      .set(auth('admin'))
      .send(post({ status: 'DRAFT', content: 'Taslak', excerpt: '' }))
      .expect(201);
    expect(draft.body).toMatchObject({ state: 'draft', publishedAt: null, slug: `${PREFIX}-kontrol-listesi` });
    postId = draft.body.id;
    // Taslak sitede görünmez
    await http().get(`/v1/blog/posts/${PREFIX}-kontrol-listesi`).expect(404);
  });

  it('yazı yayınlanır: listede, kategoride, yazar sayfasında ve site haritasında görünür', async () => {
    const res = await http()
      .patch(`/v1/admin/blog/posts/${postId}`)
      .set(auth('admin'))
      .send(post({ coverKey, coverAlt: 'Taşınmaya hazır koliler', content: content('\n![Koli düzeni](/medya/' + coverKey + ')') }))
      .expect(200);
    expect(res.body.state).toBe('published');
    expect(res.body.publishedAt).toBeTruthy();

    const list = await http().get(`/v1/blog/posts?category=${PREFIX}-tasinma-rehberi`).expect(200);
    expect(list.body).toMatchObject({ total: 1, totalPages: 1 });
    expect(list.body.items[0]).toMatchObject({
      slug: `${PREFIX}-kontrol-listesi`,
      category: { slug: `${PREFIX}-tasinma-rehberi`, name: 'Taşınma Rehberi' },
      authorName: `${PREFIX} Elif Şahin`,
      cover: { src: `/medya/${coverKey}`, alt: 'Taşınmaya hazır koliler', width: 1600, height: 900 },
    });

    const full = await http().get(`/v1/blog/posts/${PREFIX}-kontrol-listesi`).expect(200);
    expect(full.body).toMatchObject({
      summary: post().summary,
      faq: post().faq,
      author: { slug: `${PREFIX}-elif-sahin`, jobTitle: 'Nakliyat editörü' },
      images: { [`/medya/${coverKey}`]: { width: 1600, height: 900, thumb: { width: 800 } } },
    });

    const categories = await http().get('/v1/blog/categories').expect(200);
    expect(categories.body).toContainEqual(expect.objectContaining({ slug: `${PREFIX}-tasinma-rehberi`, postCount: 1 }));
    expect((await http().get(`/v1/blog/authors/${PREFIX}-elif-sahin`).expect(200)).body).toMatchObject({ postCount: 1 });
    const index = await http().get('/v1/blog/index').expect(200);
    expect(index.body.posts.map((p: { slug: string }) => p.slug)).toContain(`${PREFIX}-kontrol-listesi`);
    expect(index.body.authors.map((a: { slug: string }) => a.slug)).toContain(`${PREFIX}-elif-sahin`);

    const log = await prisma.auditLog.findFirst({ where: { entityId: postId, action: 'blog.post.publish' } });
    expect(log).toBeTruthy();
  });

  it('kullanılan görsel silinemez', async () => {
    const media = await prisma.blogMedia.findUniqueOrThrow({ where: { storageKey: coverKey } });
    await http().delete(`/v1/admin/blog/media/${media.id}`).set(auth('admin')).expect(409);
  });

  it('yayındaki yazının adresi değişince eski adres yeni adrese yönlenir', async () => {
    await http()
      .patch(`/v1/admin/blog/posts/${postId}`)
      .set(auth('admin'))
      .send(post({ slug: `${PREFIX}-tasinma-listesi`, coverKey, coverAlt: 'Koliler', markUpdated: true }))
      .expect(200);
    const old = await http().get(`/v1/blog/posts/${PREFIX}-kontrol-listesi`).expect(200);
    expect(old.body).toEqual({ redirect: `${PREFIX}-tasinma-listesi` });
    const lookup = await http().get(`/v1/blog/redirects/${PREFIX}-kontrol-listesi`).expect(200);
    expect(lookup.body).toEqual({ slug: `${PREFIX}-tasinma-listesi` });
    await http().get(`/v1/blog/redirects/${PREFIX}-tasinma-listesi`).expect(404);
    const current = await http().get(`/v1/blog/posts/${PREFIX}-tasinma-listesi`).expect(200);
    // Önemli güncelleme işaretlendi: okura gösterilen tarih ilerledi
    expect(new Date(current.body.updatedAt).getTime()).toBeGreaterThan(new Date(current.body.publishedAt).getTime());

    // Eski adres başka bir yazıya verilemez
    await http()
      .post('/v1/admin/blog/posts')
      .set(auth('admin'))
      .send(post({ status: 'DRAFT', slug: `${PREFIX}-kontrol-listesi` }))
      .expect(409);
    const log = await prisma.auditLog.findFirst({ where: { entityId: postId, action: 'blog.post.update' }, orderBy: { createdAt: 'desc' } });
    expect(log?.details).toMatchObject({ slug: { before: `${PREFIX}-kontrol-listesi`, after: `${PREFIX}-tasinma-listesi` } });
  });

  it('zamanlanmış yazı saati gelene kadar sitede görünmez', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await http()
      .post('/v1/admin/blog/posts')
      .set(auth('admin'))
      .send(post({ title: 'Yarın yayınlanacak yazı', slug: `${PREFIX}-yarin`, publishedAt: tomorrow }))
      .expect(201);
    expect(scheduled.body.state).toBe('scheduled');
    await http().get(`/v1/blog/posts/${PREFIX}-yarin`).expect(404);
    const admin = await http().get('/v1/admin/blog/posts?status=scheduled').set(auth('admin')).expect(200);
    expect(admin.body.items.map((p: { slug: string }) => p.slug)).toContain(`${PREFIX}-yarin`);
  });

  it('kategori silinince yazı kategorisiz kalır; yazı silinir', async () => {
    await http().delete(`/v1/admin/blog/categories/${categoryId}`).set(auth('admin')).expect(200);
    const full = await http().get(`/v1/blog/posts/${PREFIX}-tasinma-listesi`).expect(200);
    expect(full.body.category).toBeNull();
    await http().get(`/v1/blog/categories/${PREFIX}-tasinma-rehberi`).expect(404);

    await http().delete(`/v1/admin/blog/posts/${postId}`).set(auth('admin')).expect(204);
    await http().get(`/v1/blog/posts/${PREFIX}-tasinma-listesi`).expect(404);
    await http().get(`/v1/blog/posts/${PREFIX}-kontrol-listesi`).expect(404);
  });
});
