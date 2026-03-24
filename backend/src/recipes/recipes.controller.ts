import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { RecipesService } from './recipes.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CostPreviewDto } from './dto/cost-preview.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async findAll(
    @Query('brand_id') brand_id?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.recipesService.findAll({ brand_id, status, search });
  }

  @Get('cost-data')
  async getCostData() {
    return this.recipesService.getCostData();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(
    @Body() dto: CreateRecipeDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.recipesService.create(dto, user.id);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.recipesService.update(id, dto, user.id, isAdmin);
  }

  @Post(':id/version')
  @RequiresPermission(Permission.MANAGE_OPS)
  async createNewVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.recipesService.createNewVersion(id, user.id);
  }

  @Post(':id/cost-preview')
  @RequiresPermission(Permission.MANAGE_OPS)
  async costPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CostPreviewDto,
  ) {
    // Verify recipe exists
    await this.recipesService.findOne(id);
    return this.recipesService.calculateCostPreview(dto.bom_lines);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.remove(id);
  }
}
