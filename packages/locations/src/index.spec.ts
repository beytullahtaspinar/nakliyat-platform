import { describe, expect, it } from 'vitest';
import {
  getAllLocalPages,
  getCities,
  getCityBySlug,
  getNearestCities,
  resolveLocalPage,
} from './index.js';

describe('il ve ilçe verisi', () => {
  it('81 il ve 973 ilçe içerir', () => {
    expect(getCities()).toHaveLength(81);
    expect(getCities().reduce((n, c) => n + c.districts.length, 0)).toBe(973);
  });

  it('Türkçe karakterleri adrese çevirir', () => {
    expect(getCityBySlug('sanliurfa')?.name).toBe('Şanlıurfa');
    expect(getCityBySlug('igdir')?.name).toBe('Iğdır');
    expect(getCityBySlug('istanbul')?.districts.find((d) => d.slug === 'uskudar')?.name).toBe('Üsküdar');
  });

  it('en yakın illeri mesafeye göre sıralar', () => {
    const nearest = getNearestCities(getCityBySlug('istanbul')!, 3);
    expect(nearest[0]!.city.name).toBe('Kocaeli');
    expect(nearest.map((n) => n.distanceKm)).toEqual([...nearest.map((n) => n.distanceKm)].sort((a, b) => a - b));
  });
});

describe('resolveLocalPage', () => {
  it('il sayfası', () => {
    expect(resolveLocalPage('istanbul-evden-eve-nakliyat')).toMatchObject({ kind: 'city', city: { name: 'İstanbul' } });
  });

  it('ilçe sayfası', () => {
    expect(resolveLocalPage('istanbul-kadikoy-evden-eve-nakliyat')).toMatchObject({
      kind: 'district',
      district: { name: 'Kadıköy' },
    });
  });

  it('tireli ilçe adı', () => {
    expect(resolveLocalPage('samsun-19-mayis-evden-eve-nakliyat')).toMatchObject({
      kind: 'district',
      district: { name: '19 Mayıs' },
    });
  });

  it('şehirler arası sayfa ve mesafe', () => {
    const page = resolveLocalPage('istanbul-ankara-sehirler-arasi-nakliyat');
    expect(page).toMatchObject({ kind: 'route', from: { name: 'İstanbul' }, to: { name: 'Ankara' } });
    expect(page?.kind === 'route' && page.distanceKm).toBeGreaterThan(400);
  });

  it.each([
    'istanbul',
    'olmayan-il-evden-eve-nakliyat',
    'istanbul-olmayan-ilce-evden-eve-nakliyat',
    'istanbul-istanbul-sehirler-arasi-nakliyat',
    'istanbul-ankara-izmir-sehirler-arasi-nakliyat',
  ])('%s tanınmaz', (slug) => {
    expect(resolveLocalPage(slug)).toBeUndefined();
  });

  it('tüm adresler benzersiz ve geri çözülebilir', () => {
    const pages = getAllLocalPages();
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length);
    for (const page of pages) {
      expect(resolveLocalPage(page.slug)?.slug).toBe(page.slug);
    }
  });
});
