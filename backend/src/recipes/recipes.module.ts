import { Module } from '@nestjs/common';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { CostCalculatorService } from './cost-calculator.service';

@Module({
  controllers: [RecipesController],
  providers: [RecipesService, CostCalculatorService],
  exports: [CostCalculatorService, RecipesService],
})
export class RecipesModule {}
