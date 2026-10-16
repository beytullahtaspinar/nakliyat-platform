import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EXTENSIONS } from '../media/media-rules.js';
import { MediaService, type StoredFile } from '../media/media.service.js';
import { FILE_STORAGE, type MediaStorage } from '../media/storage.js';
import type { BlogMedia } from '../generated/prisma/client.js';
import { BLOG_RULES, blogMediaPath } from './blog-rules.js';
import { toImage } from './blog.service.js';
import type { AttachBlogMediaDto, CreateBlogUploadDto, ListBlogMediaDto } from './dto/blog.dto.js';

/**
 * Blog görselleri (kapak, içerik, yazar fotoğrafı). Tarayıcıda küçültülür (1600 px + 800 px önizleme, WebP),
 * talep ve firma dosyalarıyla aynı depoya (R2, olmazsa sunucu diski) yüklenir ve sitenin kendi adresinden
 * (/medya/blog/...) sunulur.
 */
@Injectable()
export class BlogMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    @Inject(FILE_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async list({ page, limit }: ListBlogMediaDto) {
    const [rows, total] = await Promise.all([
      this.prisma.blogMedia.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.blogMedia.count(),
    ]);
    return { items: rows.map(toView), total };
  }

  async createUpload(dto: CreateBlogUploadDto) {
    if (dto.file.sizeBytes > BLOG_RULES.imageMaxBytes || dto.thumb.sizeBytes > BLOG_RULES.thumbMaxBytes) {
      throw new BadRequestException('Görsel çok büyük');
    }
    await this.media.checkQuota(
      dto.file.sizeBytes + dto.thumb.sizeBytes,
      'Görsel yükleme şu an kullanılamıyor, lütfen daha sonra tekrar deneyin.',
    );
    const target = (file: { mimeType: string; sizeBytes: number }) => {
      const key = `blog/${randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimeType]}`;
      return { key, ...this.storage.createUpload(key, file.mimeType, file.sizeBytes) };
    };
    return { file: target(dto.file), thumb: target(dto.thumb) };
  }

  async attach(adminId: string, dto: AttachBlogMediaDto) {
    const existing = await this.prisma.blogMedia.findUnique({ where: { storageKey: dto.key } });
    if (existing) return toView(existing);

    const [main, thumb] = await Promise.all([this.storage.stat(dto.key), this.storage.stat(dto.thumbKey)]);
    const uploaded = [main && { storageKey: dto.key, storage: main.location }, thumb && { storageKey: dto.thumbKey, storage: thumb.location }]
      .filter((f): f is StoredFile => !!f);
    const allowed = BLOG_RULES.mimeTypes as readonly string[];
    const valid =
      main &&
      thumb &&
      allowed.includes(main.mimeType) &&
      allowed.includes(thumb.mimeType) &&
      main.sizeBytes <= BLOG_RULES.imageMaxBytes &&
      thumb.sizeBytes <= BLOG_RULES.thumbMaxBytes;
    if (!valid) {
      await this.media.deleteObjects(uploaded);
      throw new BadRequestException(
        !main || !thumb ? 'Görsel yüklenmemiş ya da yükleme yarıda kalmış, tekrar deneyin' : 'Görsel türü veya boyutu uygun değil',
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.blogMedia.create({
        data: {
          storageKey: dto.key,
          storage: main.location,
          thumbKey: dto.thumbKey,
          thumbStorage: thumb.location,
          mimeType: main.mimeType,
          sizeBytes: main.sizeBytes + thumb.sizeBytes,
          width: dto.size.width,
          height: dto.size.height,
          thumbWidth: dto.thumbSize.width,
          thumbHeight: dto.thumbSize.height,
          alt: dto.alt || null,
        },
      });
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'blog.media.create', entityType: 'BlogMedia', entityId: row.id, details: { key: row.storageKey } },
      });
      return row;
    });
    return toView(created);
  }

  async updateAlt(id: string, alt: string) {
    const { count } = await this.prisma.blogMedia.updateMany({ where: { id }, data: { alt: alt || null } });
    if (!count) throw new NotFoundException('Görsel bulunamadı');
    return toView((await this.prisma.blogMedia.findUnique({ where: { id } }))!);
  }

  /** Kullanılan görsel (kapak, yazar fotoğrafı ya da içerikte) silinmez: sitede kırık görsel kalmasın */
  async remove(adminId: string, id: string) {
    const item = await this.prisma.blogMedia.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Görsel bulunamadı');
    const path = blogMediaPath(item.storageKey);
    const [covers, authors, inContent] = await Promise.all([
      this.prisma.blogPost.count({ where: { coverKey: item.storageKey } }),
      this.prisma.blogAuthor.count({ where: { photoKey: item.storageKey } }),
      this.prisma.blogPost.count({ where: { content: { contains: path } } }),
    ]);
    if (covers + authors + inContent > 0) {
      throw new ConflictException('Bu görsel bir yazıda ya da yazar profilinde kullanılıyor; önce oradan kaldırın');
    }
    await this.prisma.$transaction([
      this.prisma.blogMedia.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { actorId: adminId, action: 'blog.media.delete', entityType: 'BlogMedia', entityId: id, details: { key: item.storageKey } },
      }),
    ]);
    await this.media.deleteObjects([
      { storageKey: item.storageKey, storage: item.storage },
      { storageKey: item.thumbKey, storage: item.thumbStorage },
    ]);
  }

  /** Herkese açık görsel (büyük ya da önizleme); bulunamazsa null */
  async readPublic(key: string) {
    const item = await this.prisma.blogMedia.findFirst({ where: { OR: [{ storageKey: key }, { thumbKey: key }] } });
    if (!item) return null;
    const location = item.storageKey === key ? item.storage : item.thumbStorage;
    const file = await this.storage.read(key, location);
    return file && { ...file, mimeType: item.mimeType };
  }
}

const toView = (m: BlogMedia) => ({ id: m.id, key: m.storageKey, ...toImage(m), createdAt: m.createdAt });
