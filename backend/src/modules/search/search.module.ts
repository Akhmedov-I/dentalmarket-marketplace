import { Module } from '@nestjs/common';
import { SearchService } from './services/search.service';
import { SearchController } from './controllers/search.controller';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
