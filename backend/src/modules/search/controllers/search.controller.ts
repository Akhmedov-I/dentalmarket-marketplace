import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { SearchQueryDto } from '../dto/search-query.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Faceted product search' })
  @ApiQuery({ name: 'q', required: false, description: 'Search text query' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'certification_standard', required: false })
  @ApiQuery({ name: 'price_min', required: false, type: Number })
  @ApiQuery({ name: 'price_max', required: false, type: Number })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'seller_rating_min', required: false, type: Number })
  @ApiQuery({ name: 'in_stock', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete product suggestions' })
  @ApiQuery({ name: 'q', required: true, description: 'Search prefix' })
  async suggest(@Query('q') q: string) {
    const suggestions = await this.searchService.suggest(q || '');
    return { suggestions };
  }
}
