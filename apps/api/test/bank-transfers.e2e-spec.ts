import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import type { CreditSettings } from './../src/credits/credit-rules.js';
import { CreditsService } from './../src/credits/credits.service.js';
import { DomainEvents } from './../src/events/domain-events.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { markVerified } from './helpers.js';

// Havale/EFT ile kredi yükleme: firma bildirir (dekontla), yönetim onaylar ya da reddeder.
// Banka hesapları ortak ayarda; diğer test dosyaları paralel koştuğu için veritabanına yazılmaz,
// bu dosyanın uygulamasında getSettings üzerine yazılarak verilir.
describe('Havale bildirimi (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const phones = { companyA: '+905320002001', companyB: '+905320002002', admin: '+905320002003', customer: '+905320002004' };
  const tokens: Record<string, string> = {};
  const companyIds: Record<string, string> = {};
  const IBAN = 'TR330006100519786457841326';
  const OTHER_IBAN = 'TR850001000000123456789000';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  let overrides: Partial<CreditSettings> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof phones) => ({ Authorization: `Bearer ${tokens[who]}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const pdf = Buffer.from('%PDF-1.4 sahte-dekont');
  const body = (extra: Record<string, unknown> = {}) => ({ amountTry: 1500, senderName: 'Havale Nakliyat Ltd.', transferDate: today, iban: IBAN, ...extra });
  const report = (who: 'companyA' | 'companyB', extra: Record<string, unknown> = {}, expected = 201) =>
    http().post('/v1/company/credits/transfers').set(auth(who)).send(body(extra)).expect(expected);

  const cleanup = async () => {
    const users = { phone: { in: Object.values(phones) } };
    await prisma.bankTransfer.deleteMany({ where: { company: { owner: users } } });
    await prisma.creditTransaction.deleteMany({ where: { company: { owner: users } } });
    await prisma.creditAccount.deleteMany({ where: { company: { owner: users } } });
    await prisma.company.deleteMany({ where: { owner: users } });
    await prisma.notification.deleteMany({ where: { user: users } });
    await prisma.auditLog.deleteMany({ where: { actor: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'nakliyat-havale-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.LOCAL_UPLOAD_QUOTA_MB = '50';
    delete process.env.R2_ACCOUNT_ID;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const credits = app.get(CreditsService);
    const real = credits.getSettings.bind(credits);
    vi.spyOn(credits, 'getSettings').mockImplementation(async () => {
      const r = await real();
      return { ...r, settings: { ...r.settings, ...overrides } };
    });

    for (const who of ['companyA', 'companyB', 'customer'] as const) {
      const res = await http()
        .post('/v1/auth/register')
        .send({ role: who === 'customer' ? 'CUSTOMER' : 'COMPANY', fullName: `Havale ${who}`, phone: phones[who], password: 'GucluSifre123' })
        .expect(201);
      tokens[who] = res.body.accessToken;
    }
    await markVerified(prisma, Object.values(phones));
    for (const [who, tax] of [['companyA', '5550002001'], ['companyB', '5550002002']] as const) {
      const res = await http()
        .post('/v1/company/profile')
        .set(auth(who))
        .send({ legalName: `${who} Havale Ltd.`, displayName: `${who} Havale`, taxNumber: tax, cityCode: '34', serviceCityCodes: ['34'] })
        .expect(201);
      companyIds[who] = res.body.id;
    }
    await prisma.user.create({
      data: { role: 'ADMIN', fullName: 'Havale Admin', phone: phones.admin, passwordHash: await bcrypt.hash('GucluSifre123', 4) },
    });
    tokens.admin = (await http().post('/v1/auth/login').send({ phone: phones.admin, password: 'GucluSifre123' }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.get(DomainEvents).drain();
    await cleanup();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    overrides = { bankAccounts: [{ bank: 'Ziraat Bankası', holder: 'Örnek Nakliyat A.Ş.', iban: IBAN }], minTopupTry: 100, creditValueTry: 1 };
  });

  it('banka hesabı yoksa havale bilgisi gelmez ve bildirim kapalıdır', async () => {
    overrides = { bankAccounts: [] };
    const summary = await http().get('/v1/company/credits').set(auth('companyA')).expect(200);
    expect(summary.body.transfer).toBeNull();
    const res = await report('companyA', {}, 400);
    expect(res.body.message).toContain('kapalı');
  });

  it('firma özet sayfasında hesapları ve kendine özel, değişmeyen havale kodunu görür', async () => {
    const first = (await http().get('/v1/company/credits').set(auth('companyA')).expect(200)).body.transfer;
    expect(first).toMatchObject({ minTopupTry: 100, bankAccounts: [{ bank: 'Ziraat Bankası', iban: IBAN }] });
    expect(first.code).toMatch(/^EN-[2-9A-HJKMNP-Z]{6}$/);
    const again = (await http().get('/v1/company/credits').set(auth('companyA')).expect(200)).body.transfer;
    expect(again.code).toBe(first.code);
    const other = (await http().get('/v1/company/credits').set(auth('companyB')).expect(200)).body.transfer;
    expect(other.code).not.toBe(first.code);
  });

  it('geçersiz bildirimleri reddeder', async () => {
    await http().post('/v1/company/credits/transfers').set(auth('customer')).send(body()).expect(403);
    await report('companyA', { iban: OTHER_IBAN }, 400);
    await report('companyA', { iban: 'TR12' }, 400);
    expect((await report('companyA', { amountTry: 50 }, 400)).body.message).toContain('En az 100');
    await report('companyA', { amountTry: 10.555 }, 400);
    await report('companyA', { transferDate: '2099-01-01' }, 400);
    await report('companyA', { transferDate: '2020-01-01' }, 400);
    await report('companyA', { senderName: '' }, 400);
    overrides = { ...overrides, creditValueTry: 500, minTopupTry: 100 };
    expect((await report('companyA', { amountTry: 200 }, 400)).body.message).toContain('1 kredi');
  });

  it('dekont başka firmanın dosyası ya da yüklenmemiş dosya olamaz', async () => {
    const ticket = await http()
      .post('/v1/company/credits/transfers/uploads')
      .set(auth('companyB'))
      .send({ mimeType: 'application/pdf', sizeBytes: pdf.length })
      .expect(201);
    await http().put(pathOf(ticket.body.url)).set('Content-Type', 'application/pdf').send(pdf).expect(204);
    const res = await report('companyA', { receipt: { key: ticket.body.key, fileName: 'dekont.pdf' } }, 400);
    expect(res.body.message).toContain('bu firmaya ait değil');

    const missing = await http()
      .post('/v1/company/credits/transfers/uploads')
      .set(auth('companyA'))
      .send({ mimeType: 'application/pdf', sizeBytes: pdf.length })
      .expect(201);
    await report('companyA', { receipt: { key: missing.body.key, fileName: 'dekont.pdf' } }, 400);
    await http().post('/v1/company/credits/transfers/uploads').set(auth('companyA')).send({ mimeType: 'text/plain', sizeBytes: 10 }).expect(400);
  });

  it('dekontlu bildirim → yönetim tutarı düzelterek onaylar → kredi yüklenir, firma bildirim alır', async () => {
    const ticket = await http()
      .post('/v1/company/credits/transfers/uploads')
      .set(auth('companyA'))
      .send({ mimeType: 'application/pdf', sizeBytes: pdf.length })
      .expect(201);
    await http().put(pathOf(ticket.body.url)).set('Content-Type', 'application/pdf').send(pdf).expect(204);
    const created = (await report('companyA', { iban: 'tr33 0006 1005 1978 6457 8413 26', note: 'Ekim yüklemesi', receipt: { key: ticket.body.key, fileName: 'dekont.pdf' } })).body;
    expect(created).toMatchObject({ status: 'PENDING', amountTry: '1500.00', iban: 'TR33 0006 1005 1978 6457 8413 26', receipt: { fileName: 'dekont.pdf' } });
    // Aynı dekont ikinci bildirimde kullanılamaz
    await report('companyA', { receipt: { key: ticket.body.key, fileName: 'dekont.pdf' } }, 409);

    // Yönetim: menü sayacı ve bekleyen liste
    const summary = await http().get('/v1/admin/summary').set(auth('admin')).expect(200);
    expect(summary.body.transfers.pending).toBeGreaterThanOrEqual(1);
    await http().get('/v1/admin/credits/transfers').set(auth('companyA')).expect(403);
    const code = (await http().get('/v1/company/credits').set(auth('companyA')).expect(200)).body.transfer.code;
    const list = await http().get('/v1/admin/credits/transfers').query({ status: 'PENDING', q: code.toLowerCase() }).set(auth('admin')).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id: created.id, transferCode: code, expectedCredits: 1500, company: { id: companyIds.companyA, balance: 0 } });
    expect(list.body.items[0].receipt.url).toBeTruthy();

    // Hesaba 1.450 TL geçti: yönetim düzeltir; kredi değeri onay anındaki (0,5 TL)
    overrides = { ...overrides, creditValueTry: 0.5 };
    const approved = await http().post(`/v1/admin/credits/transfers/${created.id}/approve`).set(auth('admin')).send({ amountTry: 1450 }).expect(201);
    expect(approved.body).toMatchObject({ status: 'APPROVED', approvedAmountTry: '1450.00', credits: 2900, reviewedBy: { fullName: 'Havale Admin' } });
    await http().post(`/v1/admin/credits/transfers/${created.id}/approve`).set(auth('admin')).send({}).expect(409);
    await http().post(`/v1/admin/credits/transfers/${created.id}/reject`).set(auth('admin')).send({ reason: 'Geç kaldı' }).expect(409);

    const credit = (await http().get('/v1/company/credits').set(auth('companyA')).expect(200)).body;
    expect(credit.balance).toBe(2900);
    const txs = await http().get('/v1/company/credits/transactions').query({ type: 'TRANSFER_TOPUP' }).set(auth('companyA')).expect(200);
    expect(txs.body.items[0]).toMatchObject({ amount: 2900, balanceAfter: 2900, note: 'Havale/EFT 1.450,00 TL' });

    await app.get(DomainEvents).drain();
    const note = await prisma.notification.findFirst({ where: { user: { phone: phones.companyA }, type: 'CREDIT_TRANSFER' } });
    expect(note?.title).toBe('Havalen onaylandı: 2.900 kredi yüklendi');
    const log = await prisma.auditLog.findFirst({ where: { action: 'transfer.approve', entityId: companyIds.companyA } });
    expect(log?.details).toMatchObject({ reportedTry: 1500, amountTry: 1450, credits: 2900 });
  });

  it('ret: kredi yüklenmez, gerekçe firmaya gider; firma bekleyeni geri alabilir, incelenmişi alamaz', async () => {
    const pending = (await report('companyB', { amountTry: 300 })).body;
    await http().post(`/v1/admin/credits/transfers/${pending.id}/reject`).set(auth('admin')).send({ reason: 'x' }).expect(400);
    const rejected = await http()
      .post(`/v1/admin/credits/transfers/${pending.id}/reject`)
      .set(auth('admin'))
      .send({ reason: 'Hesabımıza bu tutarda havale gelmedi' })
      .expect(201);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', rejectReason: 'Hesabımıza bu tutarda havale gelmedi', credits: null });
    expect((await http().get('/v1/company/credits').set(auth('companyB')).expect(200)).body.balance).toBe(0);
    await http().post(`/v1/company/credits/transfers/${pending.id}/cancel`).set(auth('companyB')).expect(409);
    await app.get(DomainEvents).drain();
    const note = await prisma.notification.findFirst({ where: { user: { phone: phones.companyB }, type: 'CREDIT_TRANSFER' } });
    expect(note?.title).toBe('Havale bildirimin onaylanmadı');

    const second = (await report('companyB', { amountTry: 250 })).body;
    await http().post(`/v1/company/credits/transfers/${second.id}/cancel`).set(auth('companyA')).expect(404);
    const cancelled = await http().post(`/v1/company/credits/transfers/${second.id}/cancel`).set(auth('companyB')).expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    await http().post(`/v1/admin/credits/transfers/${second.id}/approve`).set(auth('admin')).send({}).expect(409);

    const own = await http().get('/v1/company/credits/transfers').set(auth('companyB')).expect(200);
    expect(own.body.items.map((t: { status: string }) => t.status)).toEqual(['CANCELLED', 'REJECTED']);
  });

  it('aynı anda en fazla 5 bekleyen bildirim; iki onay yarışında kredi bir kez yüklenir', async () => {
    const ids: string[] = [];
    while (ids.length < 5) {
      const own = await http().get('/v1/company/credits/transfers').set(auth('companyB')).expect(200);
      const open = own.body.items.filter((t: { status: string }) => t.status === 'PENDING').length;
      if (open >= 5) break;
      ids.push((await report('companyB', { amountTry: 100 })).body.id);
    }
    expect((await report('companyB', { amountTry: 100 }, 409)).body.message).toContain('5 bildiriminiz');

    const [a, b] = await Promise.all([
      http().post(`/v1/admin/credits/transfers/${ids[0]}/approve`).set(auth('admin')).send({}),
      http().post(`/v1/admin/credits/transfers/${ids[0]}/approve`).set(auth('admin')).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const txs = await prisma.creditTransaction.count({ where: { companyId: companyIds.companyB, type: 'TRANSFER_TOPUP' } });
    expect(txs).toBe(1);
    expect((await http().get('/v1/company/credits').set(auth('companyB')).expect(200)).body.balance).toBe(100);
  });

  it('ayarlarda geçersiz IBAN ve fazla hesap reddedilir', async () => {
    const send = (bankAccounts: unknown) => http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ bankAccounts }).expect(400);
    await send([{ bank: 'Ziraat', holder: 'Örnek', iban: 'TR340006100519786457841326' }]);
    await send([{ bank: 'Ziraat', holder: 'Örnek', iban: 'DE89370400440532013000' }]);
    await send(Array.from({ length: 4 }, () => ({ bank: 'Ziraat', holder: 'Örnek', iban: IBAN })));
    await http().patch('/v1/admin/credits/settings').set(auth('admin')).send({ minTopupTry: 0 }).expect(400);
  });
});
