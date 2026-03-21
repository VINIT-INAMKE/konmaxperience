import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { getCompatibleUnits } from '../common/utils/unit-conversion';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(category?: string) {
    const where: Record<string, unknown> = {};
    if (category) {
      where.category = category;
    }
    return this.prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    }
    return ingredient;
  }

  async create(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: {
        name: dto.name,
        category: dto.category,
        base_unit: dto.base_unit,
        min_stock_level: dto.min_stock_level,
      },
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findOne(id);
    return this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.base_unit !== undefined && { base_unit: dto.base_unit }),
        ...(dto.min_stock_level !== undefined && { min_stock_level: dto.min_stock_level }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const usage = await this.prisma.recipeLine.count({
      where: { ingredient_id: id },
    });
    if (usage > 0) {
      throw new BadRequestException(
        `Cannot delete ingredient — it is used in ${usage} recipe(s). Remove it from those recipes first.`,
      );
    }
    return this.prisma.ingredient.delete({ where: { id } });
  }

  async getCompatibleUnits(id: string): Promise<string[]> {
    const ingredient = await this.findOne(id);
    return getCompatibleUnits(ingredient.base_unit, this.prisma);
  }
}
