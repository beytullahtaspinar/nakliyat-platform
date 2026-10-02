import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { StorageLocation } from '../generated/prisma/enums.js';
import { LocalStorage } from './local-storage.js';
import { R2Storage } from './r2-storage.js';
import { MediaStorage } from './storage.js';

const KEY = 'talepler/abcdefghij/0123456789abcdef0123456789abcdef.webp';

describe('R2Storage ve hibrit depo', () => {
  let server: Server;
  let respond: (req: IncomingMessage, body: Buffer) => [number, string];
  let received: { method?: string; url?: string; headers: IncomingMessage['headers']; body: Buffer }[];
  let r2: R2Storage;
  let storage: MediaStorage;
  let dir: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        received.push({ method: req.method, url: req.url, headers: req.headers, body });
        const [status, text] = respond(req, body);
        res.writeHead(status).end(text);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    r2 = new R2Storage({
      accountId: 'hesap',
      accessKeyId: 'a',
      secretAccessKey: 'b',
      bucket: 'kova',
      endpoint: `http://127.0.0.1:${port}`,
    });
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(async () => {
    received = [];
    respond = () => [200, ''];
    dir = await mkdtemp(join(tmpdir(), 'medya-'));
    const local = new LocalStorage({ dir, publicUrl: 'https://api.ornek.app/', secret: 'gizli' });
    storage = new MediaStorage(local, r2, { local: 1024, r2: 1024 });
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('yükleme adresi API’yi gösterir, belirteç anahtarı ve boyutu taşır', () => {
    const target = storage.createUpload(KEY, 'image/webp', 5);
    expect(target.url).toMatch(/^https:\/\/api\.ornek\.app\/v1\/files\/upload\/[^/]+$/);
    expect(target.headers).toEqual({ 'Content-Type': 'image/webp' });
    const grant = storage.tokens.verify(target.url.split('/').pop()!, 'put');
    expect(grant).toMatchObject({ k: KEY, t: 'image/webp', s: 5 });
  });

  it('dosyayı imzalı PUT ile R2’ye aktarır', async () => {
    await r2.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('mer'), Buffer.from('ha')]));
    expect(received).toHaveLength(1);
    const [req] = received;
    expect(req.method).toBe('PUT');
    expect(req.url).toMatch(new RegExp(`^/kova/${KEY}\\?X-Amz-Algorithm=`));
    expect(req.url).toContain('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost');
    expect(req.headers['content-type']).toBe('image/webp');
    expect(req.headers['content-length']).toBe('5');
    expect(req.body.toString()).toBe('merha');
  });

  it('R2 hatasını mesajıyla birlikte bildirir', async () => {
    respond = () => [403, '<Error><Code>AccessDenied</Code></Error>'];
    await expect(r2.write(KEY, 'image/webp', 2, Readable.from([Buffer.from('ab')]))).rejects.toThrow(
      /R2 PUT 403: .*AccessDenied/,
    );
  });

  it('hibrit: R2 çalışıyorsa dosya R2’ye gider, diskte kalmaz', async () => {
    const location = await storage.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('merha')]), true);
    expect(location).toBe(StorageLocation.R2);
    expect(received[0].body.toString()).toBe('merha');
    expect(await storage.local.stat(KEY)).toBeNull();
    expect(storage.viewUrl(KEY, location)).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/kova\//);
  });

  it('hibrit: R2 hata verirse dosya diske kaydedilir ve R2 bir süre denenmez', async () => {
    respond = () => [403, '<Error><Code>NotEntitled</Code></Error>'];
    const first = await storage.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('merha')]), true);
    expect(first).toBe(StorageLocation.LOCAL);
    expect((await readFile(storage.local.path(KEY))).toString()).toBe('merha');
    expect(storage.r2Ready()).toBe(false);
    expect(await storage.stat(KEY)).toMatchObject({ location: StorageLocation.LOCAL, sizeBytes: 5 });
    expect(storage.viewUrl(KEY, first)).toMatch(/^https:\/\/api\.ornek\.app\/v1\/files\//);

    const KEY2 = KEY.replace('0123', '9999');
    const second = await storage.write(KEY2, 'image/webp', 2, Readable.from([Buffer.from('ab')]), true);
    expect(second).toBe(StorageLocation.LOCAL);
    expect(received).toHaveLength(1); // ikinci dosyada R2 denenmedi
  });

  it('hibrit: R2 kotası doluysa (useR2=false) R2 denenmez', async () => {
    const location = await storage.write(KEY, 'image/webp', 2, Readable.from([Buffer.from('ab')]), false);
    expect(location).toBe(StorageLocation.LOCAL);
    expect(received).toHaveLength(0);
  });

  it('hibrit: eksik gelen dosya hiçbir yere kaydedilmez', async () => {
    await expect(storage.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('ab')]), true)).rejects.toThrow();
    expect(received).toHaveLength(0);
    expect(await storage.local.stat(KEY)).toBeNull();
  });

  it('hibrit: diskteki dosya R2’ye kopyalanabilir', async () => {
    await storage.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('merha')]), false);
    expect(await storage.copyToR2(KEY, 'image/webp', 5)).toBe(true);
    expect(received[0].body.toString()).toBe('merha');
  });
});
