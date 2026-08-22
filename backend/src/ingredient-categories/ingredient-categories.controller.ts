import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { IngredientCategoriesService } from './ingredient-categories.service';
import { CreateIngredientCategoryDto } from './dto/create-ingredient-category.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('ingredient-categories')
export class IngredientCategoriesController {
  constructor(private service: IngredientCategoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  create(@Body() dto: CreateIngredientCategoryDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
