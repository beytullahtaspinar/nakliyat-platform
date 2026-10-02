import { presignUrl } from './s3-presign.js';

describe('presignUrl', () => {
  // AWS belgesindeki örnek: "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)"
  it('AWS örneğindeki imzayı üretir', () => {
    const url = presignUrl({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresInSec: 86400,
      date: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('ek başlıkları imzaya katar', () => {
    const base = {
      method: 'PUT' as const,
      url: 'https://hesap.r2.cloudflarestorage.com/kova/talepler/abc/1.webp',
      region: 'auto',
      accessKeyId: 'a',
      secretAccessKey: 'b',
      expiresInSec: 600,
      date: new Date('2026-10-01T12:00:00Z'),
    };
    const signed = presignUrl({ ...base, headers: { 'Content-Type': 'image/webp', 'Content-Length': '1000' } });
    expect(signed).toContain('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost');
    expect(signed).not.toBe(presignUrl({ ...base, headers: { 'Content-Type': 'image/webp', 'Content-Length': '1001' } }));
  });
});
