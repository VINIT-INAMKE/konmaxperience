import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientCategoryDto } from './dto/create-ingredient-category.dto';

@Injectable()
export class IngredientCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredientCategory.findMany({
      orderBy: { sort_order: 'asc' },
    });
  }

  async create(dto: CreateIngredientCategoryDto) {
    return this.prisma.ingredientCategory.create({
      data: {
        name: dto.name,
        sort_order: 999,
        is_default: false,
      },
    });
  }

  async remove(id: string) {
    const cat = await this.prisma.ingredientCategory.findUnique({ where: { id } });
    if (!cat) throw new BadRequestException('Category not found');
    if (cat.is_default) throw new BadRequestException('Default categories cannot be deleted');
    return this.prisma.ingredientCategory.delete({ where: { id } });
  }
}
