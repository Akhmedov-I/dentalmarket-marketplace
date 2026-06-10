import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('products')
  async browse(
    @Query('categoryId') categoryId?: string,
    @Query('brand') brand?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.browseProducts({
      categoryId,
      brand,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      search,
    });
  }

  @Get('products/:id')
  async getDetails(@Param('id') id: string) {
    return this.catalogService.getProductDetails(id);
  }
}
