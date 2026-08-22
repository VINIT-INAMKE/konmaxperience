import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import { MediaKind, ProductStatus, ProductType } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpsertProductVariantDto } from './dto/upsert-product-variant.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';

/** Request shape after the auth guard has attached the staff user. */
type AuthedRequest = express.Request & { user: { id: string } };

const userId = (req: express.Request): string => (req as AuthedRequest).user.id;

/**
 * `/catalog/*` is the SPEC §9 surface. The `/menu/*` aliases keep P1 clients
 * (and the `/menu` frontend routes) working — P2 renames data, not routes
 * (decision 8).
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------

  @Get(['catalog/categories', 'menu/categories'])
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findCategories(@Query('brand_id') brand_id?: string) {
    return this.catalog.findCategories(brand_id);
  }

  @Post('catalog/categories')
  @RequiresPermission(Permission.MANAGE_OPS)
  async createCategory(@Body() dto: CreateProductCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('catalog/categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('catalog/categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeCategory(id);
  }

  // ----------------------------------------------------------------
  // Products
  // ----------------------------------------------------------------

  // Literal segments (`/staff`, `/search`, `/slug/:slug`) are declared before
  // any parameterised sibling so they cannot be shadowed.
  @Get(['catalog/products/staff', 'menu/items/staff'])
  async findStaff(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
    @Query('type') type?: ProductType,
  ) {
    return this.catalog.findProductsStaff(category_id, brand_id, type);
  }

  @Get('catalog/search')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async search(@Query('q') q?: string, @Query('type') type?: ProductType) {
    return this.catalog.search(q ?? '', type);
  }

  @Get('catalog/products/slug/:slug')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async bySlug(@Param('slug') slug: string) {
    return this.catalog.findProductBySlug(slug);
  }

  @Get(['catalog/products', 'menu/items'])
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findPublic(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
    @Query('type') type?: ProductType,
  ) {
    return this.catalog.findProductsPublic(category_id, brand_id, type);
  }

  @Post('catalog/products')
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateProductDto, @Req() req: express.Request) {
    return this.catalog.createProduct(dto, userId(req));
  }

  @Patch('catalog/products/:id/publish')
  @RequiresPermission(Permission.MANAGE_OPS)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.catalog.setStatus(id, ProductStatus.active, userId(req));
  }

  @Patch('catalog/products/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: express.Request,
  ) {
    return this.catalog.updateProduct(id, dto, userId(req));
  }

  /** Archives (status -> archived); OrderItem.product_id is a hard FK. */
  @Delete('catalog/products/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.catalog.archiveProduct(id, userId(req));
  }

  // ----------------------------------------------------------------
  // Variants and media
  // ----------------------------------------------------------------

  @Patch('catalog/variants')
  @RequiresPermission(Permission.MANAGE_OPS)
  async upsertVariant(@Body() dto: UpsertProductVariantDto) {
    return this.catalog.upsertVariant(dto);
  }

  @Delete('catalog/variants/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async removeVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeVariant(id);
  }

  @Post('catalog/products/:id/media')
  @RequiresPermission(Permission.MANAGE_OPS)
  async addMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: { url: string; alt?: string; sort_order?: number; kind?: MediaKind },
  ) {
    return this.catalog.addMedia(id, dto);
  }

  @Delete('catalog/media/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async removeMedia(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeMedia(id);
  }

  // ----------------------------------------------------------------
  // Availability
  // ----------------------------------------------------------------

  // IMPORTANT: Batch route BEFORE parameterized route to prevent shadowing
  @Get(['catalog/availability', 'menu/availability'])
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async allAvailability() {
    return this.catalog.getAllServingsAvailable();
  }

  @Get(['catalog/availability/:productId', 'menu/availability/:productId'])
  async availability(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.catalog.getServingsAvailable(productId);
  }

  // ----------------------------------------------------------------
  // Channel Modifiers
  // ----------------------------------------------------------------

  @Get(['catalog/channel-modifiers', 'menu/channel-modifiers'])
  async findModifiers() {
    return this.catalog.findModifiers();
  }

  @Patch(['catalog/channel-modifiers', 'menu/channel-modifiers'])
  @RequiresPermission(Permission.MANAGE_OPS)
  async upsertModifier(@Body() dto: UpsertChannelModifierDto) {
    return this.catalog.upsertModifier(dto);
  }
}
