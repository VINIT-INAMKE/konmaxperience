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
      select: {
        id: true,
        yield_qty: true,
        yield_unit: true,
        RecipeLines: {
          select: {
            input_type: true,
            quantity: true,
            unit: true,
            ingredient_id: true,
            source_recipe_id: true,
            ingredient: {
              select: {
                VendorPrices: {
                  where: { effective_date: { lte: new Date() } },
                  orderBy: { effective_date: 'desc' },
                  take: 1,
                  select: { price: true, unit: true },
                },
              },
            },
            source_recipe: {
              select: { yield_qty: true, yield_unit: true },
            },
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
    const directRecipes = await this.prisma.recipe.findMany({
      where: { RecipeLines: { some: { ingredient_id: ingredientId } } },
      select: { id: true },
    });

    // Pre-fetch ALL sub-recipe relationships in one query to avoid N+1 parent lookups
    const allSubRecipeLines = await this.prisma.recipeLine.findMany({
      where: { input_type: 'recipe', source_recipe_id: { not: null } },
      select: { recipe_id: true, source_recipe_id: true },
    });

    // Build a reverse index: child recipe ID -> parent recipe IDs
    const parentMap = new Map<string, Set<string>>();
    for (const line of allSubRecipeLines) {
      if (!line.source_recipe_id) continue;
      const parents = parentMap.get(line.source_recipe_id) ?? new Set();
      parents.add(line.recipe_id);
      parentMap.set(line.source_recipe_id, parents);
    }

    // BFS propagation: process level by level, parallelizing within each level
    const recalculated = new Set<string>();
    let currentLevel = directRecipes.map((r) => r.id);

    while (currentLevel.length > 0) {
      // Filter out already-recalculated recipes
      const toProcess = currentLevel.filter((id) => !recalculated.has(id));
      if (toProcess.length === 0) break;

      // Recalculate all recipes at this level in parallel
      await Promise.all(
        toProcess.map(async (id) => {
          await this.recalculateAndSave(id);
          recalculated.add(id);
        }),
      );

      // Collect next level: all parent recipes of the ones we just recalculated
      const nextLevel: string[] = [];
      for (const id of toProcess) {
        const parents = parentMap.get(id);
        if (parents) {
          for (const parentId of parents) {
            if (!recalculated.has(parentId)) {
              nextLevel.push(parentId);
            }
          }
        }
      }
      currentLevel = [...new Set(nextLevel)];
    }
  }
}
