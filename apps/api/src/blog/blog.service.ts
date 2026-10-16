import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BlogAuthor, BlogMedia, BlogPost, Prisma } from '../generated/prisma/client.js';
import { BlogPostStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BLOG_RULES, blogMediaPath, contentImageKeys, slugify } from './blog-rules.js';
import type {
  AdminListBlogPostsDto,
  ListBlogPostsDto,
  SaveBlogAuthorDto,
  SaveBlogCategoryDto,
  SaveBlogPostDto,
} from './dto/blog.dto.js';

export type BlogFaqItem = { question: string; answer: string };

/** Yayındaki yazı: durumu PUBLISHED ve yayın zamanı gelmiş (zamanlanmış yazı o saate kadar görünmez) */
const published = (now = new Date()): Prisma.BlogPostWhereInput => ({
  status: BlogPostStatus.PUBLISHED,
  publishedAt: { lte: now },
});

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  contentUpdatedAt: true,
  coverKey: true,
  coverAlt: true,
  category: { select: { slug: true, name: true } },
  author: { select: { slug: true, name: true } },
} satisfies Prisma.BlogPostSelect;
type SummaryRow = Prisma.BlogPostGetPayload<{ select: typeof SUMMARY_SELECT }>;

/**
 * Blog: yazılar, kategoriler ve yazar profilleri. Yönetim (/yonetim/blog) yazar, site (/blog) okur.
 * Yönetimin her değişikliği AuditLog'a yazılır (blog.*).
 */
@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Herkese açık ────────────────────────────────────────────

  async listPublished({ page, limit, category, author }: ListBlogPostsDto) {
    const where: Prisma.BlogPostWhereInput = {
      ...published(),
      ...(category && { category: { slug: category } }),
      ...(author && { author: { slug: author } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items: await this.summaries(rows), total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Eski adresin gösterdiği yayındaki yazı; yoksa 404 */
  async redirectTarget(slug: string) {
    const redirect = await this.prisma.blogSlugRedirect.findUnique({
      where: { slug },
      select: { post: { select: { slug: true, status: true, publishedAt: true } } },
    });
    const target = redirect?.post;
    if (target && target.status === BlogPostStatus.PUBLISHED && target.publishedAt && target.publishedAt <= new Date()) {
      return { slug: target.slug };
    }
    throw new NotFoundException('Yazı bulunamadı');
  }

  /** Tek yazı. Eski adresle gelinirse yeni adres döner (site kalıcı yönlendirir). */
  async getPublished(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, ...published() },
      include: { category: true, author: true },
    });
    if (!post) return { redirect: (await this.redirectTarget(slug)).slug };
    const media = await this.mediaByKeys([post.coverKey, post.author?.photoKey, ...contentImageKeys(post.content)]);
    return {
      ...this.toSummary(post, media),
      summary: post.summary,
      content: post.content,
      faq: faqOf(post.faq),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      noindex: post.noindex,
      author: post.author ? this.toAuthor(post.author, media) : null,
      /** İçerikte geçen görsellerin boyutları (sayfa kayması olmasın) ve önizlemeleri; anahtar: /medya/blog/... */
      images: Object.fromEntries(
        contentImageKeys(post.content)
          .map((key) => media.get(key))
          .filter((m): m is BlogMedia => !!m)
          .map((m) => [blogMediaPath(m.storageKey), toImage(m)]),
      ),
    };
  }

  /** Yazısı olan kategoriler, yazı sayısıyla */
  async listCategories() {
    const categories = await this.prisma.blogCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, description: true, _count: { select: { posts: { where: published() } } } },
    });
    return categories
      .filter((c) => c._count.posts > 0)
      .map(({ _count, ...c }) => ({ ...c, postCount: _count.posts }));
  }

  async getCategory(slug: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { slug },
      select: { slug: true, name: true, description: true, _count: { select: { posts: { where: published() } } } },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    const { _count, ...rest } = category;
    return { ...rest, postCount: _count.posts };
  }

  async getAuthor(slug: string) {
    const author = await this.prisma.blogAuthor.findUnique({
      where: { slug },
      include: { _count: { select: { posts: { where: published() } } } },
    });
    if (!author) throw new NotFoundException('Yazar bulunamadı');
    const media = await this.mediaByKeys([author.photoKey]);
    return { ...this.toAuthor(author, media), postCount: author._count.posts };
  }

  /** Site haritası ve llms.txt: yayındaki tüm yazılar (en fazla 5000), kategoriler ve yazarlar */
  async index() {
    const where = published();
    const [posts, categories, authors] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: { ...SUMMARY_SELECT, noindex: true, updatedAt: true },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 5000,
      }),
      this.listCategories(),
      this.prisma.blogAuthor.findMany({
        where: { posts: { some: where } },
        select: { slug: true, name: true, updatedAt: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const summaries = await this.summaries(posts);
    return {
      posts: summaries.map((s, i) => ({ ...s, noindex: posts[i].noindex, lastModified: posts[i].updatedAt })),
      categories,
      authors,
    };
  }

  // ─── Yönetim: yazılar ────────────────────────────────────────

  async adminList({ page, limit, status, categoryId, q }: AdminListBlogPostsDto) {
    const now = new Date();
    const filters: Record<NonNullable<AdminListBlogPostsDto['status']>, Prisma.BlogPostWhereInput> = {
      published: published(now),
      scheduled: { status: BlogPostStatus.PUBLISHED, OR: [{ publishedAt: { gt: now } }, { publishedAt: null }] },
      draft: { status: BlogPostStatus.DRAFT },
    };
    const where: Prisma.BlogPostWhereInput = {
      ...(status && filters[status]),
      ...(categoryId && { categoryId }),
      ...(q && { AND: [{ OR: [{ title: { contains: q } }, { slug: { contains: q } }] }] }),
    };
    const [items, total, all, publishedCount, scheduled, draft] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: { ...SUMMARY_SELECT, status: true, noindex: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.count(),
      this.prisma.blogPost.count({ where: filters.published }),
      this.prisma.blogPost.count({ where: filters.scheduled }),
      this.prisma.blogPost.count({ where: filters.draft }),
    ]);
    return {
      items: items.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        state: stateOf(p, now),
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        noindex: p.noindex,
        hasCover: !!p.coverKey,
        category: p.category,
        author: p.author,
      })),
      total,
      counts: { all, published: publishedCount, scheduled, draft },
    };
  }

  async adminGet(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id }, include: { redirects: { select: { slug: true } } } });
    if (!post) throw new NotFoundException('Yazı bulunamadı');
    const media = await this.mediaByKeys([post.coverKey]);
    const cover = post.coverKey ? media.get(post.coverKey) : undefined;
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      summary: post.summary,
      content: post.content,
      faq: faqOf(post.faq),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      noindex: post.noindex,
      status: post.status,
      state: stateOf(post, new Date()),
      publishedAt: post.publishedAt,
      contentUpdatedAt: post.contentUpdatedAt,
      coverKey: post.coverKey,
      coverAlt: post.coverAlt,
      cover: cover ? toImage(cover) : null,
      categoryId: post.categoryId,
      authorId: post.authorId,
      oldSlugs: post.redirects.map((r) => r.slug),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async create(adminId: string, dto: SaveBlogPostDto) {
    const slug = dto.slug || slugify(dto.title);
    await this.assertSlugFree(slug);
    const data = await this.postData(dto, null);
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.blogPost.create({ data: { ...data, slug } });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'blog.post.create',
          entityType: 'BlogPost',
          entityId: created.id,
          details: { title: created.title, slug, status: created.status, publishedAt: created.publishedAt },
        },
      });
      return created;
    });
    return this.adminGet(post.id);
  }

  async update(adminId: string, id: string, dto: SaveBlogPostDto) {
    const before = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Yazı bulunamadı');
    const slug = dto.slug || before.slug;
    if (slug !== before.slug) await this.assertSlugFree(slug, id);
    const data = await this.postData(dto, before);
    // Daha önce yayınlanmış yazının adresi değişirse eski adres yeni adrese yönlenir
    const keepOldSlug = slug !== before.slug && before.publishedAt !== null;
    const now = new Date();
    const wasLive = stateOf(before, now) === 'published';
    const isLive = data.status === BlogPostStatus.PUBLISHED && !!data.publishedAt && data.publishedAt <= now;
    const action = !wasLive && isLive ? 'blog.post.publish' : wasLive && !isLive ? 'blog.post.unpublish' : 'blog.post.update';

    await this.prisma.$transaction(async (tx) => {
      // Yeni adres bu yazının eski adreslerinden biriyse yönlendirme kaldırılır
      await tx.blogSlugRedirect.deleteMany({ where: { slug, postId: id } });
      await tx.blogPost.update({ where: { id }, data: { ...data, slug } });
      if (keepOldSlug) await tx.blogSlugRedirect.create({ data: { slug: before.slug, postId: id } });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action,
          entityType: 'BlogPost',
          entityId: id,
          details: {
            title: data.title,
            changed: changedFields(before, { ...data, slug }),
            ...(slug !== before.slug && { slug: { before: before.slug, after: slug } }),
            status: data.status,
            publishedAt: data.publishedAt,
          },
        },
      });
    });
    return this.adminGet(id);
  }

  async remove(adminId: string, id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id }, select: { id: true, title: true, slug: true } });
    if (!post) throw new NotFoundException('Yazı bulunamadı');
    await this.prisma.$transaction([
      this.prisma.blogPost.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'blog.post.delete', entityType: 'BlogPost', entityId: id, details: { title: post.title, slug: post.slug } },
      }),
    ]);
  }

  /** Kaydedilecek alanlar; yayınlarken içerik kurallarını uygular */
  private async postData(dto: SaveBlogPostDto, before: BlogPost | null) {
    const publishing = dto.status === BlogPostStatus.PUBLISHED;
    const excerpt = dto.excerpt.trim();
    if (publishing) {
      const problems: string[] = [];
      if (excerpt.length < BLOG_RULES.excerptMin) problems.push(`özet en az ${BLOG_RULES.excerptMin} karakter olmalı`);
      if (dto.content.trim().length < BLOG_RULES.publishMinContent) {
        problems.push(`içerik en az ${BLOG_RULES.publishMinContent} karakter olmalı`);
      }
      if (dto.coverKey && !dto.coverAlt) problems.push('kapak görselinin açıklaması (alt metin) yazılmalı');
      if (/^#\s/m.test(dto.content)) problems.push('içerikte tek # ile başlık (H1) kullanılmaz; başlık yazının adıdır, ## kullanın');
      if (problems.length) throw new BadRequestException(`Yayınlamak için: ${problems.join('; ')}.`);
    }
    if (dto.coverKey && !(await this.prisma.blogMedia.count({ where: { storageKey: dto.coverKey } }))) {
      throw new BadRequestException('Kapak görseli bulunamadı, yeniden yükleyin');
    }
    if (dto.categoryId && !(await this.prisma.blogCategory.count({ where: { id: dto.categoryId } }))) {
      throw new BadRequestException('Kategori bulunamadı');
    }
    if (dto.authorId && !(await this.prisma.blogAuthor.count({ where: { id: dto.authorId } }))) {
      throw new BadRequestException('Yazar bulunamadı');
    }

    const now = new Date();
    // Yayın zamanı: verilmişse o, yayınlanıyorsa ilk yayın zamanı ya da şimdi. Taslağa alınan yazı tarihini korur.
    const publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : (before?.publishedAt ?? (publishing ? now : null));
    const wasPublished = !!before?.publishedAt && before.publishedAt <= now;
    const faq: BlogFaqItem[] = (dto.faq ?? []).map(({ question, answer }) => ({ question, answer }));
    return {
      title: dto.title,
      excerpt,
      summary: dto.summary ?? null,
      content: dto.content,
      faq,
      seoTitle: dto.seoTitle ?? null,
      seoDescription: dto.seoDescription ?? null,
      noindex: dto.noindex ?? false,
      status: dto.status,
      publishedAt,
      contentUpdatedAt: dto.markUpdated && wasPublished ? now : (before?.contentUpdatedAt ?? null),
      coverKey: dto.coverKey ?? null,
      coverAlt: dto.coverKey ? (dto.coverAlt ?? null) : null,
      categoryId: dto.categoryId ?? null,
      authorId: dto.authorId ?? null,
    };
  }

  private async assertSlugFree(slug: string, postId?: string) {
    if (!slug) throw new BadRequestException('Başlıktan adres üretilemedi, adresi elle yazın');
    const [post, redirect] = await Promise.all([
      this.prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.blogSlugRedirect.findUnique({ where: { slug }, select: { postId: true } }),
    ]);
    if ((post && post.id !== postId) || (redirect && redirect.postId !== postId)) {
      throw new ConflictException(`"${slug}" adresi başka bir yazıda kullanılıyor, başka bir adres yazın`);
    }
  }

  // ─── Yönetim: kategoriler ────────────────────────────────────

  async adminCategories() {
    const rows = await this.prisma.blogCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { posts: true } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, postCount: _count.posts }));
  }

  async saveCategory(adminId: string, id: string | null, dto: SaveBlogCategoryDto) {
    const slug = dto.slug || slugify(dto.name);
    if (!slug) throw new BadRequestException('Addan adres üretilemedi, adresi elle yazın');
    const clash = await this.prisma.blogCategory.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) throw new ConflictException(`"${slug}" adresi başka bir kategoride kullanılıyor`);
    const data = { name: dto.name, slug, description: dto.description ?? null, sortOrder: dto.sortOrder ?? 0 };
    await this.prisma.$transaction(async (tx) => {
      if (id && !(await tx.blogCategory.count({ where: { id } }))) throw new NotFoundException('Kategori bulunamadı');
      const saved = id ? await tx.blogCategory.update({ where: { id }, data }) : await tx.blogCategory.create({ data });
      await tx.auditLog.create({
        data: { actorId: adminId, action: id ? 'blog.category.update' : 'blog.category.create', entityType: 'BlogCategory', entityId: saved.id, details: data },
      });
    });
    return this.adminCategories();
  }

  /** Kategori silinince yazıları kategorisiz kalır */
  async removeCategory(adminId: string, id: string) {
    const category = await this.prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    await this.prisma.$transaction([
      this.prisma.blogCategory.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'blog.category.delete', entityType: 'BlogCategory', entityId: id, details: { name: category.name, slug: category.slug } },
      }),
    ]);
    return this.adminCategories();
  }

  // ─── Yönetim: yazarlar ───────────────────────────────────────

  async adminAuthors() {
    const rows = await this.prisma.blogAuthor.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } });
    const media = await this.mediaByKeys(rows.map((a) => a.photoKey));
    return rows.map((a) => ({ ...this.toAuthor(a, media), id: a.id, photoKey: a.photoKey, postCount: a._count.posts }));
  }

  async saveAuthor(adminId: string, id: string | null, dto: SaveBlogAuthorDto) {
    const slug = dto.slug || slugify(dto.name);
    if (!slug) throw new BadRequestException('Addan adres üretilemedi, adresi elle yazın');
    const clash = await this.prisma.blogAuthor.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) throw new ConflictException(`"${slug}" adresi başka bir yazarda kullanılıyor`);
    if (dto.photoKey && !(await this.prisma.blogMedia.count({ where: { storageKey: dto.photoKey } }))) {
      throw new BadRequestException('Fotoğraf bulunamadı, yeniden yükleyin');
    }
    const data = {
      name: dto.name,
      slug,
      jobTitle: dto.jobTitle ?? null,
      bio: dto.bio ?? null,
      photoKey: dto.photoKey ?? null,
      sameAs: dto.sameAs ?? [],
    };
    await this.prisma.$transaction(async (tx) => {
      if (id && !(await tx.blogAuthor.count({ where: { id } }))) throw new NotFoundException('Yazar bulunamadı');
      const saved = id ? await tx.blogAuthor.update({ where: { id }, data }) : await tx.blogAuthor.create({ data });
      await tx.auditLog.create({
        data: { actorId: adminId, action: id ? 'blog.author.update' : 'blog.author.create', entityType: 'BlogAuthor', entityId: saved.id, details: { name: data.name, slug } },
      });
    });
    return this.adminAuthors();
  }

  /** Yazar silinince yazıları imzasız (yayıncı adına) kalır */
  async removeAuthor(adminId: string, id: string) {
    const author = await this.prisma.blogAuthor.findUnique({ where: { id } });
    if (!author) throw new NotFoundException('Yazar bulunamadı');
    await this.prisma.$transaction([
      this.prisma.blogAuthor.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'blog.author.delete', entityType: 'BlogAuthor', entityId: id, details: { name: author.name, slug: author.slug } },
      }),
    ]);
    return this.adminAuthors();
  }

  // ─── Dönüştürme ──────────────────────────────────────────────

  private async summaries(rows: SummaryRow[]) {
    const media = await this.mediaByKeys(rows.map((r) => r.coverKey));
    return rows.map((r) => this.toSummary(r, media));
  }

  private toSummary(post: SummaryRow, media: Map<string, BlogMedia>) {
    const cover = post.coverKey ? media.get(post.coverKey) : undefined;
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt!,
      /** Okura gösterilen güncelleme tarihi (önemli değişiklikte ilerler) */
      updatedAt: post.contentUpdatedAt ?? post.publishedAt!,
      cover: cover ? { ...toImage(cover), alt: post.coverAlt ?? cover.alt ?? '' } : null,
      category: post.category ? { slug: post.category.slug, name: post.category.name } : null,
      authorSlug: post.author?.slug ?? null,
      authorName: post.author?.name ?? null,
    };
  }

  private toAuthor(author: BlogAuthor, media: Map<string, BlogMedia>) {
    const photo = author.photoKey ? media.get(author.photoKey) : undefined;
    return {
      slug: author.slug,
      name: author.name,
      jobTitle: author.jobTitle,
      bio: author.bio,
      photo: photo ? toImage(photo) : null,
      sameAs: Array.isArray(author.sameAs) ? (author.sameAs as string[]) : [],
    };
  }

  private async mediaByKeys(keys: (string | null | undefined)[]) {
    const wanted = [...new Set(keys.filter((k): k is string => !!k))];
    if (!wanted.length) return new Map<string, BlogMedia>();
    const rows = await this.prisma.blogMedia.findMany({ where: { storageKey: { in: wanted } } });
    return new Map(rows.map((m) => [m.storageKey, m]));
  }
}

/** Görsel: büyük hali ve önizlemesi, sitedeki adresleriyle */
export function toImage(m: BlogMedia) {
  return {
    src: blogMediaPath(m.storageKey),
    width: m.width,
    height: m.height,
    thumb: { src: blogMediaPath(m.thumbKey), width: m.thumbWidth, height: m.thumbHeight },
    alt: m.alt ?? '',
  };
}

const faqOf = (value: Prisma.JsonValue | null): BlogFaqItem[] =>
  Array.isArray(value)
    ? value.filter((f): f is BlogFaqItem => !!f && typeof f === 'object' && 'question' in f && 'answer' in f)
    : [];

/** Yönetimde gösterilen durum */
function stateOf(post: { status: BlogPostStatus; publishedAt: Date | null }, now: Date) {
  if (post.status === BlogPostStatus.DRAFT) return 'draft' as const;
  return post.publishedAt && post.publishedAt <= now ? ('published' as const) : ('scheduled' as const);
}

/** Karar geçmişi için: hangi alanlar değişti (içerik kendisi yazılmaz, yalnızca değiştiği) */
function changedFields(before: BlogPost, after: Record<string, unknown>) {
  return Object.keys(after).filter((key) => {
    const a = after[key];
    const b = before[key as keyof BlogPost];
    if (a instanceof Date || b instanceof Date) return (a as Date | null)?.getTime() !== (b as Date | null)?.getTime();
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}
