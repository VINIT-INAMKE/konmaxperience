-- Add preparation_type to Recipe
ALTER TABLE "Recipe" ADD COLUMN "preparation_type" TEXT NOT NULL DEFAULT 'scratch';

-- Make prep_steps and cooking_method nullable
ALTER TABLE "Recipe" ALTER COLUMN "prep_steps" DROP NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "cooking_method" DROP NOT NULL;

-- Add usage_type to Ingredient
ALTER TABLE "Ingredient" ADD COLUMN "usage_type" TEXT NOT NULL DEFAULT 'recipe_input';

-- Create IngredientCategory table
CREATE TABLE "IngredientCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngredientCategory_name_key" ON "IngredientCategory"("name");

-- Add category_id FK to Ingredient (nullable initially)
ALTER TABLE "Ingredient" ADD COLUMN "category_id" TEXT;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "IngredientCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make old category column nullable
ALTER TABLE "Ingredient" ALTER COLUMN "category" DROP NOT NULL;
