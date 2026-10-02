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
import { markVerified } from './helpers.js';

type Summary = {
  documents: { id: string; type: string; status: string; url: string; reviewNote: string | null; validUntil: string | null }[];
  requirements: { type: string; state: string }[];
};

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL). Dosyalar geçici klasöre (yerel sürücü) yazılır.
describe('Firma belgeleri (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const tokens: Record<'company' | 'other' | 'customer' | 'admin', string> = {} as never;
  const phones = {
    company: '+905320000501',
    other: '+905320000502',
    customer: '+905320000503',
    admin: '+905320000504',
  };
  let companyId: string;
  let otherCompanyId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const pdf = Buffer.from('%PDF-1.4 sahte-belge');

  /** Silinen hesabın telefonu değiştiği için temizlikte kimlikle bulunur */
  const deletedUserIds: string[] = [];
  const cleanup = async () => {
    const users = { OR: [{ phone: { in: Object.values(phones) } }, { id: { in: deletedUserIds } }] };
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const register = async (phone: string, role: 'CUSTOMER' | 'COMPANY') => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ role, fullName: 'Belge Test', phone, password: 'GucluSifre123' })
      .expect(201);
    return res.body.accessToken as string;
  };

  /** Dosyayı yükler; anahtarı döner */
  const upload = async (who: 'company' | 'other', body = pdf, mimeType = 'application/pdf') => {
    const ticket = await http()
      .post('/v1/company/documents/uploads')
      .set(auth(who))
      .send({ mimeType, sizeBytes: body.length })
      .expect(201);
    await http().put(pathOf(ticket.body.url)).set('Content-Type', mimeType).send(body).expect(204);
    return ticket.body.key as string;
  };

  const attach = async (type: string, extra: Record<string, unknown> = {}, expected = 200) => {
    const key = await upload('company');
    const res = await http()
      .post('/v1/company/documents')
      .set(auth('company'))
      .send({ type, key, fileName: `${type}.pdf`, ...extra })
      .expect(expected);
    return res.body as Summary;
  };

  const state = (summary: Summary, type: string) => summary.requirements.find((r) => r.type === type)?.state;
  const ofType = (summary: Summary, type: string) => summary.documents.filter((d) => d.type === type);
  const review = (id: string, action: 'approve' | 'reject', reason?: string) =>
    http()
      .post(`/v1/admin/companies/${companyId}/documents/${id}/${action}`)
      .set(auth('admin'))
      .send(reason ? { reason } : {})
      .expect(200);

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-belge-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.LOCAL_UPLOAD_QUOTA_MB = '50';
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    tokens.company = await register(phones.company, 'COMPANY');
    tokens.other = await register(phones.other, 'COMPANY');
    tokens.customer = await register(phones.customer, 'CUSTOMER');
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const profile = (taxNumber: string) => ({
      legalName: 'Belge Nakliyat Ltd.',
      displayName: 'Belge Nakliyat',
      taxNumber,
      cityCode: '55',
      serviceCityCodes: ['55'],
    });
    companyId = (await http().post('/v1/company/profile').set(auth('company')).send(profile('6600000001')).expect(201)).body.id;
    otherCompanyId = (await http().post('/v1/company/profile').set(auth('other')).send(profile('6600000002')).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('yeni firmada zorunlu belgelerin hepsi eksik; yönetici firmayı onaylayamaz', async () => {
    const res = await http().get('/v1/company/documents').set(auth('company')).expect(200);
    expect(res.body).toEqual({
      documents: [],
      requirements: [
        { type: 'K3_LICENSE', state: 'MISSING' },
        { type: 'TAX_CERTIFICATE', state: 'MISSING' },
        { type: 'TRADE_REGISTRY', state: 'MISSING' },
      ],
    });
    const verify = await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(409);
    expect(verify.body.message).toContain('K3 yetki belgesi');
  });

  it('müşteri ve giriş yapmamış kullanıcı belge uçlarını kullanamaz', async () => {
    await http().get('/v1/company/documents').set(auth('customer')).expect(403);
    await http().get('/v1/company/documents').expect(401);
  });

  it('K3 geçerlilik tarihi olmadan veya süresi dolmuşsa kaydedilmez', async () => {
    const missing = await attach('K3_LICENSE', {}, 400);
    expect(JSON.stringify(missing)).toContain('geçerlilik bitiş tarihini');
    await attach('K3_LICENSE', { validUntil: inDays(-1) }, 400);
    await attach('K3_LICENSE', { validUntil: '2030-02-30' }, 400);
  });

  it('firma K3 belgesini yükler; PDF imzalı adresle açılır', async () => {
    const summary = await attach('K3_LICENSE', { validUntil: inDays(400) });
    expect(state(summary, 'K3_LICENSE')).toBe('PENDING');
    const [k3] = ofType(summary, 'K3_LICENSE');
    expect(k3).toMatchObject({ status: 'PENDING', validUntil: inDays(400), fileName: 'K3_LICENSE.pdf' });
    const file = await http().get(pathOf(k3!.url)).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(file.body).equals(pdf)).toBe(true);
  });

  it('desteklenmeyen tür, 10 MB üstü ve başka firmanın dosyası reddedilir', async () => {
    const send = (body: object) => http().post('/v1/company/documents/uploads').set(auth('company')).send(body);
    await send({ mimeType: 'image/svg+xml', sizeBytes: 100 }).expect(400);
    await send({ mimeType: 'text/html', sizeBytes: 100 }).expect(400);
    await send({ mimeType: 'application/pdf', sizeBytes: 11 * 1024 * 1024 }).expect(400);

    const foreignKey = await upload('other');
    expect(foreignKey).toMatch(new RegExp(`^firmalar/${otherCompanyId}/[a-f0-9]{32}\\.pdf$`));
    await http()
      .post('/v1/company/documents')
      .set(auth('company'))
      .send({ type: 'TAX_CERTIFICATE', key: foreignKey, fileName: 'x.pdf' })
      .expect(400);
  });

  it('JPG fotoğraf da belge olarak yüklenebilir', async () => {
    const key = await upload('company', Buffer.from('sahte-jpg'), 'image/jpeg');
    const res = await http()
      .post('/v1/company/documents')
      .set(auth('company'))
      .send({ type: 'TRADE_REGISTRY', key, fileName: 'sicil.jpg' })
      .expect(200);
    expect(ofType(res.body, 'TRADE_REGISTRY')[0]).toMatchObject({ mimeType: 'image/jpeg', status: 'PENDING' });
  });

  it('yönetici belgeyi reddeder; firma gerekçeyi görür, yenisini yükleyince eskisi silinir', async () => {
    const first = await attach('TAX_CERTIFICATE');
    const [old] = ofType(first, 'TAX_CERTIFICATE');
    const rejected = (await review(old!.id, 'reject', 'Vergi levhası okunmuyor')).body as Summary;
    expect(state(rejected, 'TAX_CERTIFICATE')).toBe('REJECTED');

    const own = await http().get('/v1/company/documents').set(auth('company')).expect(200);
    expect(ofType(own.body, 'TAX_CERTIFICATE')[0]).toMatchObject({ status: 'REJECTED', reviewNote: 'Vergi levhası okunmuyor' });

    const second = await attach('TAX_CERTIFICATE');
    expect(ofType(second, 'TAX_CERTIFICATE')).toHaveLength(1);
    expect(state(second, 'TAX_CERTIFICATE')).toBe('PENDING');
    await http().get(pathOf(old!.url)).expect(404);
  });

  it('zorunlu belgeler onaylanınca firma onaylanır; onaylı belge silinemez', async () => {
    const { body } = await http().get(`/v1/admin/companies/${companyId}`).set(auth('admin')).expect(200);
    for (const doc of (body as Summary).documents) await review(doc.id, 'approve');
    const res = await http().get(`/v1/admin/companies/${companyId}`).set(auth('admin')).expect(200);
    expect(res.body.requirements.every((r: { state: string }) => r.state === 'VERIFIED')).toBe(true);
    await http().post(`/v1/admin/companies/${companyId}/verify`).set(auth('admin')).expect(200);

    const k3 = ofType(res.body, 'K3_LICENSE')[0]!;
    await http().delete(`/v1/company/documents/${k3.id}`).set(auth('company')).expect(409);
    await http().delete(`/v1/company/documents/${k3.id}`).set(auth('other')).expect(404);
    const history = await prisma.auditLog.count({ where: { entityId: companyId, action: 'company.document.approve' } });
    expect(history).toBe(3);
  });

  it('K3 yenilenirken onaylı eskisi kalır, yenisi onaylanınca eskisi silinir', async () => {
    const renewed = await attach('K3_LICENSE', { validUntil: inDays(1500) });
    const k3s = ofType(renewed, 'K3_LICENSE');
    expect(k3s.map((d) => d.status)).toEqual(['PENDING', 'VERIFIED']);
    expect(state(renewed, 'K3_LICENSE')).toBe('VERIFIED');

    const approved = (await review(k3s[0]!.id, 'approve')).body as Summary;
    expect(ofType(approved, 'K3_LICENSE')).toEqual([expect.objectContaining({ status: 'VERIFIED', validUntil: inDays(1500) })]);
    await http().get(pathOf(k3s[1]!.url)).expect(404);
  });

  it('K3 süresi dolunca firma teklif veremez ve belge "süresi dolmuş" görünür', async () => {
    await prisma.companyDocument.updateMany({
      where: { companyId, type: 'K3_LICENSE' },
      data: { validUntil: new Date(`${inDays(-2)}T00:00:00.000Z`) },
    });
    const own = await http().get('/v1/company/documents').set(auth('company')).expect(200);
    expect(state(own.body, 'K3_LICENSE')).toBe('EXPIRED');
    expect(ofType(own.body, 'K3_LICENSE')[0]).toMatchObject({ expired: true });

    const quote = await http()
      .post('/v1/company/requests/olmayan-talep/quotes')
      .set(auth('company'))
      .send({ priceTry: 20000, crewSize: 3, vehicleType: 'KAMYON' })
      .expect(403);
    expect(quote.body.message).toContain('K3');
  });

  it('ek belge silinebilir; reddedilmiş firma yeni belge yükleyince yeniden incelemeye girer', async () => {
    await http()
      .post(`/v1/admin/companies/${companyId}/reject`)
      .set(auth('admin'))
      .send({ reason: 'K3 belgesinin süresi dolmuş' })
      .expect(200);
    const summary = await attach('OTHER');
    const profile = await http().get('/v1/company/profile').set(auth('company')).expect(200);
    expect(profile.body.verificationStatus).toBe('PENDING');

    const other = ofType(summary, 'OTHER')[0]!;
    await http().delete(`/v1/company/documents/${other.id}`).set(auth('company')).expect(204);
    await http().get(pathOf(other.url)).expect(404);
  });

  it('hesap silinince firmanın belgeleri de silinir', async () => {
    const { body } = await http().get('/v1/company/documents').set(auth('other')).expect(200);
    const key = await upload('other');
    await http().post('/v1/company/documents').set(auth('other')).send({ type: 'INSURANCE', key, fileName: 'police.pdf' }).expect(200);
    const after = await http().get('/v1/company/documents').set(auth('other')).expect(200);
    expect((after.body as Summary).documents).toHaveLength((body as Summary).documents.length + 1);
    const url = pathOf((after.body as Summary).documents[0]!.url);
    await http().get(url).expect(200);

    const owner = await prisma.user.findUniqueOrThrow({ where: { phone: phones.other } });
    deletedUserIds.push(owner.id);
    await http().delete(`/v1/admin/users/${owner.id}`).set(auth('admin')).expect(204);
    expect(await prisma.companyDocument.count({ where: { companyId: otherCompanyId } })).toBe(0);
    await http().get(url).expect(404);
  });
});
