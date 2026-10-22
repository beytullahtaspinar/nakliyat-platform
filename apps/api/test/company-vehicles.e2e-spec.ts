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

type VehicleView = {
  id: string;
  plate: string;
  type: string;
  authorization: string;
  status: string;
  reviewNote: string | null;
  files: { kind: string; url: string; mimeType: string; fileName: string }[];
};
type Summary = { vehicles: VehicleView[]; verifiedCount: number };

// Çalışan bir MariaDB/MySQL gerektirir (DATABASE_URL). Dosyalar geçici klasöre (yerel sürücü) yazılır.
describe('Firma araçları (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const tokens: Record<'company' | 'other' | 'customer' | 'admin', string> = {} as never;
  const phones = {
    company: '+905320002301',
    other: '+905320002302',
    customer: '+905320002303',
    admin: '+905320002304',
  };
  const companyIds: Record<'company' | 'other', string> = {} as never;
  // Testler paralel koşan başka dosyalardaki rastgele plakalarla çakışmasın: 81 ili ve Q/W/X harflerini kullanan sabit plakalar
  const PLATE = '81QWX4321';
  const PLATE_2 = '81QWX4322';

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const jpg = Buffer.from('sahte-jpg');
  const pdf = Buffer.from('%PDF-1.4 sahte-ruhsat');

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  const register = async (phone: string, role: 'CUSTOMER' | 'COMPANY') => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ role, fullName: 'Araç Test', phone, password: 'GucluSifre123' })
      .expect(201);
    return res.body.accessToken as string;
  };

  const upload = async (who: 'company' | 'other', kind: string, body = jpg, mimeType = 'image/jpeg') => {
    const ticket = await http()
      .post('/v1/company/vehicles/uploads')
      .set(auth(who))
      .send({ kind, mimeType, sizeBytes: body.length })
      .expect(201);
    await http().put(pathOf(ticket.body.url)).set('Content-Type', mimeType).send(body).expect(204);
    return { key: ticket.body.key as string, fileName: `${kind.toLowerCase()}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}` };
  };

  const allFiles = async (who: 'company' | 'other' = 'company') => ({
    REGISTRATION: await upload(who, 'REGISTRATION', pdf, 'application/pdf'),
    FRONT: await upload(who, 'FRONT'),
    SIDE: await upload(who, 'SIDE'),
    REAR: await upload(who, 'REAR'),
  });

  const review = (vehicleId: string, decision: 'approve' | 'reject', reason?: string) =>
    http()
      .post(`/v1/admin/companies/${companyIds.company}/vehicles/${vehicleId}/${decision}`)
      .set(auth('admin'))
      .send(reason ? { reason } : {})
      .expect(200);

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-arac-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.LOCAL_UPLOAD_QUOTA_MB = '50';
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await prisma.vehicle.deleteMany({ where: { plate: { startsWith: '81QWX' } } });
    tokens.company = await register(phones.company, 'COMPANY');
    tokens.other = await register(phones.other, 'COMPANY');
    tokens.customer = await register(phones.customer, 'CUSTOMER');
    await markVerified(prisma, Object.values(phones));
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;

    const profile = (taxNumber: string) => ({
      legalName: 'Araç Nakliyat Ltd.',
      displayName: 'Araç Nakliyat',
      taxNumber,
      cityCode: '55',
      serviceCityCodes: ['55'],
    });
    companyIds.company = (await http().post('/v1/company/profile').set(auth('company')).send(profile('6700000001')).expect(201)).body.id;
    companyIds.other = (await http().post('/v1/company/profile').set(auth('other')).send(profile('6700000002')).expect(201)).body.id;
    // Belgeler tamam, testler yalnızca araç şartını sınar. Yardımcı onaylı araç da ekler: o araçlar silinir.
    await addApprovedDocuments(prisma, Object.values(companyIds));
    await prisma.vehicle.deleteMany({ where: { companyId: { in: Object.values(companyIds) } } });
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('araçsız firma onaylanamaz; müşteri araç uçlarını kullanamaz', async () => {
    const own = await http().get('/v1/company/vehicles').set(auth('company')).expect(200);
    expect(own.body).toEqual({ vehicles: [], verifiedCount: 0 });
    const verify = await http().post(`/v1/admin/companies/${companyIds.company}/verify`).set(auth('admin')).expect(409);
    expect(verify.body.message).toContain('Onaylı araç');
    await http().get('/v1/company/vehicles').set(auth('customer')).expect(403);
    await http().get('/v1/company/vehicles').expect(401);
  });

  it('dört dosyadan biri eksikse, plaka geçersizse ya da yetki belgesi seçilmemişse araç kaydedilmez', async () => {
    const files = await allFiles();
    const send = (body: object) => http().post('/v1/company/vehicles').set(auth('company')).send(body);
    const { REAR: _rear, ...withoutRear } = files;
    const missing = await send({ plate: PLATE, type: 'KAMYON', authorization: 'K3', files: withoutRear }).expect(400);
    expect(missing.body.message).toContain('Arkadan fotoğraf');
    await send({ plate: '99 ABC 123', type: 'KAMYON', authorization: 'K3', files }).expect(400);
    await send({ plate: 'ABC', type: 'KAMYON', authorization: 'K3', files }).expect(400);
    await send({ plate: PLATE, type: 'KAMYON', authorization: 'K1', files }).expect(400);
    await send({ plate: PLATE, type: 'KAMYON', files }).expect(400);
  });

  it('fotoğraf için PDF ya da 5 MB üstü, ruhsat için 10 MB üstü kabul edilmez; başka firmanın dosyası kullanılamaz', async () => {
    const ticket = (kind: string, mimeType: string, sizeBytes: number) =>
      http().post('/v1/company/vehicles/uploads').set(auth('company')).send({ kind, mimeType, sizeBytes });
    await ticket('FRONT', 'application/pdf', 100).expect(400);
    await ticket('FRONT', 'image/jpeg', 6 * 1024 * 1024).expect(400);
    await ticket('REGISTRATION', 'application/pdf', 11 * 1024 * 1024).expect(400);
    await ticket('REGISTRATION', 'image/svg+xml', 100).expect(400);

    const foreign = await upload('other', 'FRONT');
    const files = { ...(await allFiles()), FRONT: foreign };
    await http()
      .post('/v1/company/vehicles')
      .set(auth('company'))
      .send({ plate: PLATE, type: 'KAMYON', authorization: 'K3', files })
      .expect(400);
  });

  it('firma aracı ruhsat ve üç fotoğrafla ekler; plaka boşluksuz büyük harfle kaydedilir, dosyalar açılır', async () => {
    const files = await allFiles();
    const res = await http()
      .post('/v1/company/vehicles')
      .set(auth('company'))
      .send({ plate: '81 qwx 4321', type: 'KAMYON', authorization: 'L1', files })
      .expect(200);
    const summary = res.body as Summary;
    expect(summary.verifiedCount).toBe(0);
    expect(summary.vehicles).toHaveLength(1);
    const [vehicle] = summary.vehicles;
    expect(vehicle).toMatchObject({ plate: PLATE, type: 'KAMYON', authorization: 'L1', status: 'PENDING' });
    expect(vehicle!.files.map((f) => f.kind)).toEqual(['REGISTRATION', 'FRONT', 'SIDE', 'REAR']);
    const registration = await http().get(pathOf(vehicle!.files[0]!.url)).expect(200);
    expect(registration.headers['content-type']).toBe('application/pdf');

    // Aynı plaka iki kez eklenemez
    const again = await allFiles();
    await http()
      .post('/v1/company/vehicles')
      .set(auth('company'))
      .send({ plate: PLATE, type: 'KAMYON', authorization: 'K3', files: again })
      .expect(409);
  });

  it('incelemedeki plaka başka firmada eklenemez', async () => {
    const files = await allFiles('other');
    const res = await http()
      .post('/v1/company/vehicles')
      .set(auth('other'))
      .send({ plate: PLATE, type: 'KAMYON', authorization: 'K3', files })
      .expect(409);
    expect(res.body.message).toContain('başka bir firmada kayıtlı');
  });

  it('yönetici onay bekleyen aracı listede ruhsat ve fotoğraflarıyla görür, sayaçta sayılır', async () => {
    const list = await http().get(`/v1/admin/vehicles?status=PENDING&q=81 QWX`).set(auth('admin')).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        plate: PLATE,
        company: expect.objectContaining({ id: companyIds.company, verificationStatus: 'PENDING' }),
        files: expect.arrayContaining([expect.objectContaining({ kind: 'SIDE' })]),
      }),
    ]);
    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.vehicles.pending).toBeGreaterThanOrEqual(1);
    await http().get('/v1/admin/vehicles').set(auth('company')).expect(403);
    const detail = await http().get(`/v1/admin/companies/${companyIds.company}`).set(auth('admin')).expect(200);
    expect(detail.body.vehicles).toHaveLength(1);
  });

  it('reddedilen araç gerekçesiyle görünür; firma tek fotoğrafı değiştirince yeniden incelemeye girer', async () => {
    const [vehicle] = ((await http().get('/v1/company/vehicles').set(auth('company'))).body as Summary).vehicles;
    await review(vehicle!.id, 'reject', 'Arkadan fotoğrafta plaka okunmuyor');
    const own = (await http().get('/v1/company/vehicles').set(auth('company')).expect(200)).body as Summary;
    expect(own.vehicles[0]).toMatchObject({ status: 'REJECTED', reviewNote: 'Arkadan fotoğrafta plaka okunmuyor' });
    const oldRear = own.vehicles[0]!.files.find((f) => f.kind === 'REAR')!;
    const oldFront = own.vehicles[0]!.files.find((f) => f.kind === 'FRONT')!;

    const rear = await upload('company', 'REAR');
    const fixed = await http()
      .patch(`/v1/company/vehicles/${vehicle!.id}`)
      .set(auth('company'))
      .send({ files: { REAR: rear } })
      .expect(200);
    const updated = (fixed.body as Summary).vehicles[0]!;
    expect(updated).toMatchObject({ status: 'PENDING', reviewNote: null, plate: PLATE });
    expect(updated.files).toHaveLength(4);
    expect(updated.files.find((f) => f.kind === 'FRONT')!.url).toBe(oldFront.url);
    await http().get(pathOf(oldRear.url)).expect(404);
    await http().patch(`/v1/company/vehicles/${vehicle!.id}`).set(auth('other')).send({ type: 'TIR' }).expect(404);
  });

  it('araç onaylanınca firma onaylanır; onaylı araç değiştirilemez, tek onaylı araç silinemez', async () => {
    const [vehicle] = ((await http().get('/v1/company/vehicles').set(auth('company'))).body as Summary).vehicles;
    const approved = (await review(vehicle!.id, 'approve')).body as Summary;
    expect(approved.verifiedCount).toBe(1);
    await http().post(`/v1/admin/companies/${companyIds.company}/verify`).set(auth('admin')).expect(200);

    await http().patch(`/v1/company/vehicles/${vehicle!.id}`).set(auth('company')).send({ type: 'TIR' }).expect(409);
    const del = await http().delete(`/v1/company/vehicles/${vehicle!.id}`).set(auth('company')).expect(409);
    expect(del.body.message).toContain('Onaylı tek aracın');
    const overview = await http().get('/v1/company/overview').set(auth('company')).expect(200);
    expect(overview.body.vehicles).toEqual({ verified: 1, pending: 0, rejected: 0 });

    // Onaylı plaka başka firmada da eklenemez
    const otherFiles = await allFiles('other');
    await http()
      .post('/v1/company/vehicles')
      .set(auth('other'))
      .send({ plate: PLATE, type: 'KAMYON', authorization: 'K3', files: otherFiles })
      .expect(409);
    const history = await prisma.auditLog.findMany({
      where: { entityId: companyIds.company, action: { startsWith: 'company.vehicle.' } },
      select: { action: true },
    });
    expect(history.map((h) => h.action).sort()).toEqual(
      ['company.vehicle.approve', 'company.vehicle.reject', 'company.vehicle.update', 'company.vehicle.upload'].sort(),
    );
  });

  it('ikinci araç onaylanınca ilki silinebilir; dosyaları da silinir', async () => {
    const [first] = ((await http().get('/v1/company/vehicles').set(auth('company'))).body as Summary).vehicles;
    const files = await allFiles();
    const added = await http()
      .post('/v1/company/vehicles')
      .set(auth('company'))
      .send({ plate: PLATE_2, type: 'KAMYONET', authorization: 'K3', files })
      .expect(200);
    const second = (added.body as Summary).vehicles.find((v) => v.plate === PLATE_2)!;
    await review(second.id, 'approve');
    await http().delete(`/v1/company/vehicles/${first!.id}`).set(auth('company')).expect(204);
    await http().get(pathOf(first!.files[0]!.url)).expect(404);
    const own = (await http().get('/v1/company/vehicles').set(auth('company')).expect(200)).body as Summary;
    expect(own.vehicles.map((v) => v.plate)).toEqual([PLATE_2]);
  });

  it('reddedilmiş firma araç ekleyince yeniden incelemeye girer', async () => {
    await http()
      .post(`/v1/admin/companies/${companyIds.other}/reject`)
      .set(auth('admin'))
      .send({ reason: 'Araç bilgisi eksik' })
      .expect(200);
    const files = await allFiles('other');
    await http()
      .post('/v1/company/vehicles')
      .set(auth('other'))
      .send({ plate: '81QWX4323', type: 'KAMYON', authorization: 'K3', files })
      .expect(200);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyIds.other } });
    expect(company.verificationStatus).toBe('PENDING');
  });
});
