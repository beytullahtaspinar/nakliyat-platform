import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { BlogMediaService } from './blog-media.service.js';
import { BlogService } from './blog.service.js';
import {
  AdminListBlogPostsDto,
  AttachBlogMediaDto,
  CreateBlogUploadDto,
  ListBlogMediaDto,
  SaveBlogAuthorDto,
  SaveBlogCategoryDto,
  SaveBlogPostDto,
  UpdateBlogMediaDto,
} from './dto/blog.dto.js';

@ApiTags('Admin: blog')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(
    private readonly blog: BlogService,
    private readonly media: BlogMediaService,
  ) {}

  // ─── Yazılar ─────────────────────────────────────────────────

  /** Tüm yazılar (taslak ve zamanlanmışlar dahil), durum sayaçlarıyla */
  @Get('posts')
  list(@Query() dto: AdminListBlogPostsDto) {
    return this.blog.adminList(dto);
  }

  @Get('posts/:id')
  get(@Param('id') id: string) {
    return this.blog.adminGet(id);
  }

  @Post('posts')
  create(@CurrentUser() admin: AuthUser, @Body() dto: SaveBlogPostDto) {
    return this.blog.create(admin.id, dto);
  }

  /** Yayındaki yazının adresi değişirse eski adres yeni adrese yönlenir */
  @Patch('posts/:id')
  update(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: SaveBlogPostDto) {
    return this.blog.update(admin.id, id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.blog.remove(admin.id, id);
  }

  // ─── Kategoriler ─────────────────────────────────────────────

  @Get('categories')
  categories() {
    return this.blog.adminCategories();
  }

  @Post('categories')
  createCategory(@CurrentUser() admin: AuthUser, @Body() dto: SaveBlogCategoryDto) {
    return this.blog.saveCategory(admin.id, null, dto);
  }

  @Patch('categories/:id')
  updateCategory(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: SaveBlogCategoryDto) {
    return this.blog.saveCategory(admin.id, id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.blog.removeCategory(admin.id, id);
  }

  // ─── Yazarlar ────────────────────────────────────────────────

  @Get('authors')
  authors() {
    return this.blog.adminAuthors();
  }

  @Post('authors')
  createAuthor(@CurrentUser() admin: AuthUser, @Body() dto: SaveBlogAuthorDto) {
    return this.blog.saveAuthor(admin.id, null, dto);
  }

  @Patch('authors/:id')
  updateAuthor(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: SaveBlogAuthorDto) {
    return this.blog.saveAuthor(admin.id, id, dto);
  }

  @Delete('authors/:id')
  removeAuthor(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.blog.removeAuthor(admin.id, id);
  }

  // ─── Görseller ───────────────────────────────────────────────

  @Get('media')
  mediaList(@Query() dto: ListBlogMediaDto) {
    return this.media.list(dto);
  }

  /** Büyük görsel ve önizleme için kısa süreli yükleme adresleri */
  @Post('media/uploads')
  createUpload(@Body() dto: CreateBlogUploadDto) {
    return this.media.createUpload(dto);
  }

  /** Yüklenen görseli kütüphaneye ekler */
  @Post('media')
  attach(@CurrentUser() admin: AuthUser, @Body() dto: AttachBlogMediaDto) {
    return this.media.attach(admin.id, dto);
  }

  @Patch('media/:id')
  updateMedia(@Param('id') id: string, @Body() dto: UpdateBlogMediaDto) {
    return this.media.updateAlt(id, dto.alt);
  }

  @Delete('media/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMedia(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.media.remove(admin.id, id);
  }
}
