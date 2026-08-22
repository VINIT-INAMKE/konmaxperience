import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MenuService } from './menu.service';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------

  @Get('categories')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findCategories(@Query('brand_id') brand_id?: string) {
    return this.menuService.findCategories(brand_id);
  }

  @Post('categories')
  @RequiresPermission(Permission.MANAGE_OPS)
  async createCategory(@Body() dto: CreateMenuCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.removeCategory(id);
  }

  // ----------------------------------------------------------------
  // Menu Items
  // ----------------------------------------------------------------

  @Get('items')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findItems(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
  ) {
    return this.menuService.findItemsPublic(category_id, brand_id);
  }

  // Authenticated staff (any role) — includes recipe cost/yield for ops screens
  @Get('items/staff')
  async findItemsStaff(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
  ) {
    return this.menuService.findItemsStaff(category_id, brand_id);
  }

  @Post('items')
  @RequiresPermission(Permission.MANAGE_OPS)
  async createItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(dto);
  }

  @Patch('items/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async removeItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.removeItem(id);
  }

  // ----------------------------------------------------------------
  // Availability
  // ----------------------------------------------------------------

  // IMPORTANT: Batch route BEFORE parameterized route to prevent shadowing
  @Get('availability')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getAllServingsAvailable() {
    return this.menuService.getAllServingsAvailable();
  }

  @Get('availability/:menuItemId')
  async getServingsAvailable(
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
  ) {
    return this.menuService.getServingsAvailable(menuItemId);
  }

  // ----------------------------------------------------------------
  // Channel Modifiers
  // ----------------------------------------------------------------

  @Get('channel-modifiers')
  async findModifiers() {
    return this.menuService.findModifiers();
  }

  @Patch('channel-modifiers')
  @RequiresPermission(Permission.MANAGE_OPS)
  async upsertModifier(@Body() dto: UpsertChannelModifierDto) {
    return this.menuService.upsertModifier(dto);
  }
}
