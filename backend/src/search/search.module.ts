import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { CatalogModule } from '../catalog/catalog.module';
import { GuidesModule } from '../guides/guides.module';

/** Reuses the live services' query shapes rather than writing new SQL. */
@Module({
  imports: [CatalogModule, GuidesModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
