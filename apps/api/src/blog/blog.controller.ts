import { pipeline } from 'node:stream/promises';
import { Controller, Get, Logger, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { BLOG_MEDIA_KEY_PATTERN, SLUG_PATTERN } from './blog-rules.js';
import { BlogMediaService } from './blog-media.service.js';
import { BlogService } from './blog.service.js';
import { ListBlogPostsDto } from './dto/blog.dto.js';

const slugParam = (slug: string) => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 200) throw new NotFoundException();
  return slug;
};

/** Sitenin /blog sayfaları: yalnızca yayındaki yazılar (web sitesi önbelleğe alır) */
@ApiTags('Blog')
@Public()
@SkipThrottle()
@Controller()
export class BlogController {
  private readonly logger = new Logger(BlogController.name);

  constructor(
    private readonly blog: BlogService,
    private readonly media: BlogMediaService,
  ) {}

  @Get('blog/posts')
  list(@Query() dto: ListBlogPostsDto) {
    return this.blog.listPublished(dto);
  }

  /** Yazı; eski adresle istenirse { redirect: yeni-adres } */
  @Get('blog/posts/:slug')
  get(@Param('slug') slug: string) {
    return this.blog.getPublished(slugParam(slug));
  }

  /** Eski adres → yeni adres (site isteği sayfaya gelmeden yönlendirir); eski adres değilse 404 */
  @Get('blog/redirects/:slug')
  redirect(@Param('slug') slug: string) {
    return this.blog.redirectTarget(slugParam(slug));
  }

  @Get('blog/categories')
  categories() {
    return this.blog.listCategories();
  }

  @Get('blog/categories/:slug')
  category(@Param('slug') slug: string) {
    return this.blog.getCategory(slugParam(slug));
  }

  @Get('blog/authors/:slug')
  author(@Param('slug') slug: string) {
    return this.blog.getAuthor(slugParam(slug));
  }

  /** Site haritası, RSS ve llms.txt için tüm yayındaki yazılar */
  @Get('blog/index')
  index() {
    return this.blog.index();
  }

  /** Blog görseli; site /medya/blog/... adresinden aktarır */
  @ApiExcludeEndpoint()
  @Get('public-media/blog/:file')
  async file(@Param('file') file: string, @Res() res: Response) {
    const key = `blog/${file}`;
    if (!BLOG_MEDIA_KEY_PATTERN.test(key)) throw new NotFoundException();
    const found = await this.media.readPublic(key);
    if (!found) throw new NotFoundException();
    res.set({
      'Content-Type': found.mimeType,
      ...(found.sizeBytes > 0 && { 'Content-Length': String(found.sizeBytes) }),
      // Dosya adı rastgele ve içerik değişmez
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    try {
      await pipeline(found.body, res);
    } catch (err) {
      this.logger.warn(`Görsel gönderilemedi (${key}): ${(err as Error).message}`);
      res.destroy();
    }
  }
}
