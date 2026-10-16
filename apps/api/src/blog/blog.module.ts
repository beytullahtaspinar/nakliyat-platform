import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AdminBlogController } from './admin-blog.controller.js';
import { BlogMediaService } from './blog-media.service.js';
import { BlogController } from './blog.controller.js';
import { BlogService } from './blog.service.js';

/** Blog: yönetimden yazılır (/yonetim/blog), sitede /blog altında yayınlanır */
@Module({
  imports: [MediaModule],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService, BlogMediaService],
})
export class BlogModule {}
