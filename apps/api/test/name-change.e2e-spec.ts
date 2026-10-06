import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { addApprovedDocuments, markVerified } from './helpers.js';

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL).
describe('Firma görünen ad değişikliği (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<'company' | 'admin', string> = {} as never;
  const phones = { company: '+905320001901', admin: '+905320001902' };
  let companyId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const rename = (displayName: string, expected = 200) =>
    http().patch('/v1/company/profile').set(auth('company')).send({ displayName }).expect(expected);
  const pendingId = async () =>
    (await prisma.companyNameChange.findFirstOrThrow({ where: { companyId, status: 'PENDING' } })).id;
  const decide = (id: string, action: 'approve' | 'reject', expected = 200, reason?: string) =>
    http()
      .post(`/v1/admin/name-changes/${id}/${action}`)
      .set(auth('admin'))
      .send(reason ? { reason } : {})
      .expect(expected);
  const publicName = async () => (await http().get(`/v1/companies/${companyId}`).expect(200)).body.displayName as string;

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    tokens.company = (
      await http()
        .post('/v1/auth/register')
        .send({ role: 'COMPANY', fullName: 'Ad Test', phone: phones.company, password: 'GucluSifre123' })
        .expect(201)
    ).body.accessToken;
    await markVerified(prisma, [phones.company]);
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
    companyId = (
      await http()
        .post('/v1/company/profile')
        .set(auth('company'))
        .send({ legalName: 'Adlı Nakliyat Ltd. Şti.', displayName: 'Adlı Nakliyat', taxNumber: '6600001901', cityCode: '16', serviceCityCodes: ['16'] })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
  });

  it('onaysız firma adını doğrudan değiştirir; unvanı değiştiremez', async () => {
    const res = await rename('Adlı Taşımacılık');
    expect(res.body.displayName).toBe('Adlı Taşımacılık');
    expect(res.body.nameChange).toMatchObject({ pending: null, remaining: 2, limit: 2 });
    await http().patch('/v1/company/profile').set(auth('company')).send({ legalName: 'Başka Ltd.' }).expect(400);

    await addApprovedDocuments(prisma, [companyId]);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);
  });

  it('onaylı firmanın yeni adı onaya düşer, eski ad ve unvan yayında kalır', async () => {
    const res = await rename('Yıldız Nakliyat');
    expect(res.body.displayName).toBe('Adlı Taşımacılık');
    expect(res.body.nameChange.pending).toMatchObject({ newName: 'Yıldız Nakliyat' });
    expect(res.body.verificationStatus).toBe('VERIFIED');

    const profile = await http().get(`/v1/companies/${companyId}`).expect(200);
    expect(profile.body).toMatchObject({ displayName: 'Adlı Taşımacılık', legalName: 'Adlı Nakliyat Ltd. Şti.' });

    // Yayındaki ada dönmek bekleyen talebi geri çeker
    const reverted = await rename('Adlı Taşımacılık');
    expect(reverted.body.nameChange.pending).toBeNull();
    expect(await prisma.companyNameChange.count({ where: { companyId } })).toBe(0);
  });

  it('yönetim onaylayınca yeni ad yayına girer ve firmaya bildirim gider', async () => {
    await rename('Yıldız Nakliyat');
    // Bekleyen talep varken yeni bir ad öncekinin yerine geçer
    await rename('Yıldız Evden Eve');
    expect(await prisma.companyNameChange.count({ where: { companyId } })).toBe(1);

    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.nameChanges.pending).toBeGreaterThanOrEqual(1);
    const list = await http().get('/v1/admin/name-changes?status=PENDING&q=Yıldız Evden').set(auth('admin')).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({ oldName: 'Adlı Taşımacılık', newName: 'Yıldız Evden Eve', company: expect.objectContaining({ id: companyId }) }),
    ]);

    const id = await pendingId();
    await http().post(`/v1/admin/name-changes/${id}/approve`).set(auth('company')).expect(403);
    const approved = await decide(id, 'approve');
    expect(approved.body.company.displayName).toBe('Yıldız Evden Eve');
    expect(await publicName()).toBe('Yıldız Evden Eve');
    await decide(id, 'reject', 409, 'Zaten karar verildi.');

    await app.get(DomainEvents).drain();
    const owner = await prisma.user.findUniqueOrThrow({ where: { phone: phones.company } });
    const note = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id, title: 'Yeni firma adın yayında' } });
    expect(note.body).toContain('Yıldız Evden Eve');
  });

  it('ret gerekçesi firma panelinde görünür, ad değişmez ve hak düşmez', async () => {
    await rename('Kötü Ad');
    await decide(await pendingId(), 'reject', 400, 'kısa');
    await decide(await pendingId(), 'reject', 200, 'Ad unvanla ilgisiz görünüyor.');
    expect(await publicName()).toBe('Yıldız Evden Eve');
    const own = await http().get('/v1/company/profile').set(auth('company')).expect(200);
    expect(own.body.nameChange).toMatchObject({
      pending: null,
      remaining: 1,
      lastRejected: { newName: 'Kötü Ad', reviewNote: 'Ad unvanla ilgisiz görünüyor.' },
    });
  });

  it('yılda en fazla iki değişiklik onaylanır; yönetimin düzeltmesi sınıra sayılmaz', async () => {
    await rename('Yıldız Lojistik');
    await decide(await pendingId(), 'approve');
    const own = await http().get('/v1/company/profile').set(auth('company')).expect(200);
    expect(own.body.nameChange).toMatchObject({ remaining: 0, used: 2, lastRejected: null });
    expect(own.body.nameChange.nextAvailableAt).toEqual(expect.any(String));

    const blocked = await rename('Üçüncü Ad', 400);
    expect(blocked.body.message).toContain('yılda en fazla 2');
    // Ad dışındaki alanlar ad aynı gönderildiğinde kaydedilir
    await http()
      .patch('/v1/company/profile')
      .set(auth('company'))
      .send({ displayName: 'Yıldız Lojistik', serviceCityCodes: ['16', '06'] })
      .expect(200);

    const admin = await http()
      .patch(`/v1/admin/companies/${companyId}`)
      .set(auth('admin'))
      .send({ displayName: 'Yıldız Lojistik A.Ş.', legalName: 'Yıldız Lojistik A.Ş.' })
      .expect(200);
    expect(admin.body).toMatchObject({ displayName: 'Yıldız Lojistik A.Ş.', legalName: 'Yıldız Lojistik A.Ş.', verificationStatus: 'VERIFIED' });

    const detail = await http().get(`/v1/admin/companies/${companyId}`).set(auth('admin')).expect(200);
    expect(detail.body.nameChanges.map((c: { status: string }) => c.status)).toEqual(['VERIFIED', 'REJECTED', 'VERIFIED']);
    expect(detail.body.history.map((h: { action: string }) => h.action)).toContain('company.name_change.approve');
  });
});
