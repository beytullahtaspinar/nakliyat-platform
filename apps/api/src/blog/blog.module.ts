import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AdminBlogController } from './admin-blog.controller.js';
import { BlogMediaService } from './blog-media.service.js';
import { BlogController } from './blog.controller.js';
import { BlogService } from './blog.service.js';
import { AdminLocalPagesController, LocalPagesController } from './local-pages.controller.js';
import { LocalPagesService } from './local-pages.service.js';

/**
 * Blog: yönetimden yazılır (/yonetim/blog), sitede /blog altında yayınlanır.
 * Bölge sayfalarının yönetimden yazılan içeriği de burada: aynı görsel kütüphanesini ve Markdown'ı kullanır.
 */
@Module({
  imports: [MediaModule],
  controllers: [BlogController, AdminBlogController, LocalPagesController, AdminLocalPagesController],
  providers: [BlogService, BlogMediaService, LocalPagesService],
})
export class BlogModule {}
