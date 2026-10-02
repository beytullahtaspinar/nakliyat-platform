import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { R2Storage } from './r2-storage.js';

const KEY = 'talepler/abcdefghij/0123456789abcdef0123456789abcdef.webp';

describe('R2Storage', () => {
  let server: Server;
  let respond: (req: IncomingMessage, body: Buffer) => [number, string];
  let received: { method?: string; url?: string; headers: IncomingMessage['headers']; body: Buffer }[];
  let storage: R2Storage;

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
    storage = new R2Storage({
      accountId: 'hesap',
      accessKeyId: 'a',
      secretAccessKey: 'b',
      bucket: 'kova',
      endpoint: `http://127.0.0.1:${port}`,
      quotaBytes: 1024,
      publicUrl: 'https://api.ornek.app/',
      secret: 'gizli',
    });
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    received = [];
    respond = () => [200, ''];
  });

  it('yükleme adresi API’yi gösterir, belirteç anahtarı ve boyutu taşır', () => {
    const target = storage.createUpload(KEY, 'image/webp', 5);
    expect(target.url).toMatch(/^https:\/\/api\.ornek\.app\/v1\/files\/upload\/[^/]+$/);
    expect(target.headers).toEqual({ 'Content-Type': 'image/webp' });
    const grant = storage.tokens.verify(target.url.split('/').pop()!, 'put');
    expect(grant).toMatchObject({ k: KEY, t: 'image/webp', s: 5 });
  });

  it('dosyayı imzalı PUT ile R2’ye aktarır', async () => {
    await storage.write(KEY, 'image/webp', 5, Readable.from([Buffer.from('mer'), Buffer.from('ha')]));
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
    await expect(storage.write(KEY, 'image/webp', 2, Readable.from([Buffer.from('ab')]))).rejects.toThrow(
      /R2 PUT 403: .*AccessDenied/,
    );
  });
});
