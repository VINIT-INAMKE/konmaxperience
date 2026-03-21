import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { convertUnit } from '../common/utils/unit-conversion';

@Injectable()
export class CostCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateRecipeCost(
    recipeId: string,
    visitedSet: Set<string> = new Set(),
  ): Promise<number | null> {
    if (visitedSet.has(recipeId)) return null; // cycle guard
    visitedSet.add(recipeId);

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        RecipeLines: {
          include: {
            ingredient: {
              include: {
                VendorPrices: { orderBy: { effective_date: 'desc' }, take: 1 },
              },
            },
            source_recipe: true,
          },
        },
      },
    });

    if (!recipe || recipe.RecipeLines.length === 0) return null;

    let totalCost = 0;
    for (const line of recipe.RecipeLines) {
      if (line.input_type === 'ingredient') {
        const price = line.ingredient?.VendorPrices?.[0];
        if (!price) return null; // missing vendor price — cannot calculate
        const convertedQty = await convertUnit(
          Number(line.quantity),
          line.unit,
          price.unit,
          this.prisma,
        );
        if (convertedQty === null) return null;
        totalCost += convertedQty * Number(price.price);
      } else if (line.input_type === 'recipe' && line.source_recipe_id) {
        const srcCost = await this.calculateRecipeCost(
          line.source_recipe_id,
          visitedSet,
        );
        if (srcCost === null) return null;
        const srcYieldQty = Number(line.source_recipe!.yield_qty);
        if (srcYieldQty === 0) return null;
        const costPerUnit = srcCost / srcYieldQty;
        const convertedQty = await convertUnit(
          Number(line.quantity),
          line.unit,
          line.source_recipe!.yield_unit,
          this.prisma,
        );
        if (convertedQty === null) return null;
        totalCost += costPerUnit * convertedQty;
      }
    }
    return totalCost;
  }

  async recalculateAndSave(recipeId: string): Promise<number | null> {
    const cost = await this.calculateRecipeCost(recipeId);
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { computed_cost: cost },
    });
    return cost;
  }

  // Called by VendorsService when a VendorPrice is saved
  async recalculateForIngredient(ingredientId: string): Promise<void> {
    // Find all recipes that directly use this ingredient
    const directLines = await this.prisma.recipeLine.findMany({
      where: { ingredient_id: ingredientId },
      select: { recipe_id: true },
    });
    const directRecipeIds = [
      ...new Set(directLines.map((l) => l.recipe_id)),
    ];

    // Recalculate each direct recipe
    for (const recipeId of directRecipeIds) {
      await this.recalculateAndSave(recipeId);
    }

    // One level of propagation: find recipes that use any of the recalculated recipes as BOM input
    if (directRecipeIds.length > 0) {
      const parentLines = await this.prisma.recipeLine.findMany({
        where: { source_recipe_id: { in: directRecipeIds } },
        select: { recipe_id: true },
      });
      const parentRecipeIds = [
        ...new Set(parentLines.map((l) => l.recipe_id)),
      ];
      for (const recipeId of parentRecipeIds) {
        await this.recalculateAndSave(recipeId);
      }
    }
  }
}
