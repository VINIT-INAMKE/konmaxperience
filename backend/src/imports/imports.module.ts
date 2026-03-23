import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { TemplateService } from './template.service';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { VendorsModule } from '../vendors/vendors.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RecipesModule } from '../recipes/recipes.module';

@Module({
  imports: [IngredientsModule, VendorsModule, InventoryModule, RecipesModule],
  controllers: [ImportsController],
  providers: [ImportsService, TemplateService],
})
export class ImportsModule {}
