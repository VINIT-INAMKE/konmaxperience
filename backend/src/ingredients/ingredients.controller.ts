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
import { IngredientsService } from './ingredients.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  async findAll(
    @Query('category_id') categoryId?: string,
    @Query('usage_type') usageType?: string,
  ) {
    return this.ingredientsService.findAll(categoryId, usageType);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Get(':id/compatible-units')
  async getCompatibleUnits(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientsService.getCompatibleUnits(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientsService.remove(id);
  }
}
