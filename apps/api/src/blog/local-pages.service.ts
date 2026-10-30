import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type BlogMedia, type LocalPageContent } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { blogMediaPath, contentImageKeys } from './blog-rules.js';
import { toImage } from './blog.service.js';
import type { SaveLocalPageDto } from './dto/local-page.dto.js';
import { isLocalPageSlug } from './local-page-rules.js';

type FaqItem = { question: string; answer: string };

const FIELDS = ['seoTitle', 'seoDescription', 'heading', 'intro', 'content', 'coverKey', 'coverAlt'] as const;

/**
 * Bölge sayfalarının (il, ilçe, güzergâh, merkez) yönetimden yazılan içeriği. Görseller blog kütüphanesinden.
 * Boş bırakılan alanın yerine sayfanın otomatik metni kullanılır; hepsi boşsa satır silinir.
 */
@Injectable()
export class LocalPagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Düzenlenmiş tüm sayfalar, görselleriyle (sitedeki yüzlerce bölge sayfası tek yanıtı paylaşır) */
  async listPublic() {
    const rows = await this.prisma.localPageContent.findMany({ orderBy: { slug: 'asc' } });
    const media = await this.mediaByKeys(rows.flatMap((r) => [r.coverKey, ...contentImageKeys(r.content ?? '')]));
    return { items: rows.map((r) => this.toView(r, media)) };
  }

  /** Yönetim listesi: hangi sayfalar düzenlendi */
  async adminList() {
    const rows = await this.prisma.localPageContent.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, updatedAt: true },
    });
    return { items: rows };
  }

  async adminGet(slug: string) {
    this.assertSlug(slug);
    const row = await this.prisma.localPageContent.findUnique({ where: { slug } });
    if (!row) return null;
    const media = await this.mediaByKeys([row.coverKey, ...contentImageKeys(row.content ?? '')]);
    return this.toView(row, media);
  }

  async save(adminId: string, slug: string, dto: SaveLocalPageDto) {
    this.assertSlug(slug);
    if (dto.coverKey) {
      const cover = await this.prisma.blogMedia.findUnique({ where: { storageKey: dto.coverKey } });
      if (!cover) throw new NotFoundException('Kapak görseli bulunamadı, tekrar seçin');
    }
    const data = {
      ...Object.fromEntries(FIELDS.map((f) => [f, dto[f] ?? null])),
      faq: dto.faq?.length ? (dto.faq as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    } as Omit<Prisma.LocalPageContentCreateInput, 'slug'>;
    // Kapak yoksa alt metni de anlamsız
    if (!data.coverKey) data.coverAlt = null;
    const empty = FIELDS.every((f) => !data[f]) && !dto.faq?.length;
    if (empty) {
      await this.reset(adminId, slug);
      return null;
    }
    await this.prisma.$transaction([
      this.prisma.localPageContent.upsert({
        where: { slug },
        create: { slug, ...data, updatedById: adminId },
        update: { ...data, updatedById: adminId },
      }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'local-page.update', entityType: 'LocalPageContent', entityId: slug },
      }),
    ]);
    return this.adminGet(slug);
  }

  /** Varsayılana dön: sayfa yeniden tamamen otomatik metinle çizilir */
  async reset(adminId: string, slug: string) {
    this.assertSlug(slug);
    const { count } = await this.prisma.localPageContent.deleteMany({ where: { slug } });
    if (count) {
      await this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'local-page.reset', entityType: 'LocalPageContent', entityId: slug },
      });
    }
  }

  private assertSlug(slug: string) {
    if (!isLocalPageSlug(slug)) throw new NotFoundException('Böyle bir bölge sayfası yok');
  }

  private toView(row: LocalPageContent, media: Map<string, BlogMedia>) {
    const cover = row.coverKey ? media.get(row.coverKey) : undefined;
    return {
      slug: row.slug,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      heading: row.heading,
      intro: row.intro,
      content: row.content,
      faq: faqOf(row.faq),
      coverKey: row.coverKey,
      cover: cover ? { ...toImage(cover), alt: row.coverAlt ?? cover.alt ?? '' } : null,
      /** İçerikteki görsellerin boyutları ve önizlemeleri; anahtar: /medya/blog/... */
      images: Object.fromEntries(
        contentImageKeys(row.content ?? '')
          .map((key) => media.get(key))
          .filter((m): m is BlogMedia => !!m)
          .map((m) => [blogMediaPath(m.storageKey), toImage(m)]),
      ),
      updatedAt: row.updatedAt,
    };
  }

  private async mediaByKeys(keys: (string | null | undefined)[]) {
    const wanted = [...new Set(keys.filter((k): k is string => !!k))];
    if (!wanted.length) return new Map<string, BlogMedia>();
    const rows = await this.prisma.blogMedia.findMany({ where: { storageKey: { in: wanted } } });
    return new Map(rows.map((m) => [m.storageKey, m]));
  }
}

const faqOf = (value: Prisma.JsonValue | null): FaqItem[] =>
  Array.isArray(value)
    ? value.filter((f): f is FaqItem => !!f && typeof f === 'object' && 'question' in f && 'answer' in f)
    : [];
