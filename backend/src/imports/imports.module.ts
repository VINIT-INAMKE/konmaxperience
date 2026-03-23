import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { TemplateService } from './template.service';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [IngredientsModule, VendorsModule],
  controllers: [ImportsController],
  providers: [ImportsService, TemplateService],
})
export class ImportsModule {}
