import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/db/prisma.service';
import { SearchQueryDto, SearchSort } from '../dto/search-query.dto';

/**
 * SearchService — OpenSearch integration for faceted product search.
 * Uses plain fetch() to communicate with the OpenSearch REST API.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'dentalmarket_products';
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.config.get<string>('OPENSEARCH_URL', 'http://localhost:9200');
  }

  async onModuleInit() {
    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.warn(`OpenSearch not available, search features disabled: ${error}`);
    }
  }

  /**
   * Ensure the index exists with proper mappings.
   */
  private async ensureIndex(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${this.indexName}`, { method: 'HEAD' });
    if (res.status === 404) {
      const body = {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              product_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'trim'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: { type: 'text', analyzer: 'product_analyzer', fields: { keyword: { type: 'keyword' } } },
            description: { type: 'text', analyzer: 'product_analyzer' },
            brand: { type: 'keyword' },
            category_id: { type: 'keyword' },
            category_name: { type: 'keyword' },
            category_path: { type: 'keyword' },
            seller_id: { type: 'keyword' },
            seller_name: { type: 'keyword' },
            seller_rating: { type: 'float' },
            base_price: { type: 'long' },
            currency: { type: 'keyword' },
            status: { type: 'keyword' },
            rating_avg: { type: 'float' },
            rating_count: { type: 'integer' },
            certification_standards: { type: 'keyword' },
            in_stock: { type: 'boolean' },
            created_at: { type: 'date' },
          },
        },
      };

      const createRes = await fetch(`${this.baseUrl}/${this.indexName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!createRes.ok) {
        this.logger.error(`Failed to create index: ${await createRes.text()}`);
      } else {
        this.logger.log(`Created OpenSearch index: ${this.indexName}`);
      }
    }
  }

  /**
   * Faceted search with aggregations.
   */
  async search(query: SearchQueryDto): Promise<{
    hits: any[];
    total: number;
    facets: Record<string, any>;
  }> {
    const must: any[] = [];
    const filter: any[] = [{ term: { status: 'active' } }];

    // Full-text query
    if (query.q) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ['title^3', 'description', 'brand^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Facet filters
    if (query.category) filter.push({ term: { category_id: query.category } });
    if (query.certification_standard) filter.push({ term: { certification_standards: query.certification_standard } });
    if (query.brand) filter.push({ term: { brand: query.brand } });
    if (query.in_stock !== undefined) filter.push({ term: { in_stock: query.in_stock } });
    if (query.seller_rating_min) filter.push({ range: { seller_rating: { gte: query.seller_rating_min } } });
    if (query.price_min || query.price_max) {
      const range: any = {};
      if (query.price_min) range.gte = query.price_min;
      if (query.price_max) range.lte = query.price_max;
      filter.push({ range: { base_price: range } });
    }

    // Sort
    const sort = this.buildSort(query.sort);

    // Search after (cursor-based pagination)
    let searchAfter: any[] | undefined;
    if (query.cursor) {
      try {
        searchAfter = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
      } catch {
        // Invalid cursor, ignore
      }
    }

    const body: any = {
      size: query.limit || 24,
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort,
      aggs: {
        categories: { terms: { field: 'category_name', size: 50 } },
        brands: { terms: { field: 'brand', size: 50 } },
        certification_standards: { terms: { field: 'certification_standards', size: 20 } },
        price_range: { stats: { field: 'base_price' } },
        avg_rating: { avg: { field: 'rating_avg' } },
      },
    };

    if (searchAfter) {
      body.search_after = searchAfter;
    }

    try {
      const res = await fetch(`${this.baseUrl}/${this.indexName}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as any;
      const hits = (data.hits?.hits || []).map((h: any) => ({
        ...h._source,
        _score: h._score,
        _sort: h.sort,
      }));

      const lastHit = hits[hits.length - 1];
      const nextCursor = lastHit?._sort
        ? Buffer.from(JSON.stringify(lastHit._sort)).toString('base64url')
        : undefined;

      return {
        hits: hits.map((h: any) => ({ ...h, _cursor: nextCursor })),
        total: data.hits?.total?.value || 0,
        facets: data.aggregations || {},
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      return { hits: [], total: 0, facets: {} };
    }
  }

  /**
   * Autocomplete suggestions.
   */
  async suggest(prefix: string): Promise<string[]> {
    try {
      const body = {
        size: 10,
        query: {
          multi_match: {
            query: prefix,
            fields: ['title^3', 'brand^2'],
            type: 'phrase_prefix',
          },
        },
        _source: ['title'],
      };

      const res = await fetch(`${this.baseUrl}/${this.indexName}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as any;
      return (data.hits?.hits || []).map((h: any) => h._source.title);
    } catch (error) {
      this.logger.error(`Suggest failed: ${error}`);
      return [];
    }
  }

  /**
   * Index a single product.
   */
  async indexProduct(product: any): Promise<void> {
    const doc = await this.buildDocument(product);
    if (!doc) return;

    try {
      await fetch(`${this.baseUrl}/${this.indexName}/_doc/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}: ${error}`);
    }
  }

  /**
   * Remove a product from the index.
   */
  async removeProduct(productId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/${this.indexName}/_doc/${productId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      this.logger.error(`Failed to remove product ${productId}: ${error}`);
    }
  }

  /**
   * Re-index all active products.
   */
  async reindexAll(): Promise<{ indexed: number; failed: number }> {
    const products = await this.prisma.product.findMany({
      where: { status: 'active' },
      include: {
        category: true,
        seller: {
          include: { user: true },
        },
        certifications: {
          include: { standard: true },
          where: { status: 'verified' },
        },
        variants: {
          include: { inventory: true },
        },
      },
    });

    let indexed = 0;
    let failed = 0;

    // Bulk index
    const bulkBody: string[] = [];
    for (const product of products) {
      const doc = this.buildDocumentFromRelations(product);
      bulkBody.push(JSON.stringify({ index: { _index: this.indexName, _id: product.id } }));
      bulkBody.push(JSON.stringify(doc));
    }

    if (bulkBody.length > 0) {
      try {
        const res = await fetch(`${this.baseUrl}/_bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-ndjson' },
          body: bulkBody.join('\n') + '\n',
        });
        const result = await res.json() as any;
        indexed = result.items?.filter((i: any) => !i.index?.error).length || 0;
        failed = result.items?.filter((i: any) => i.index?.error).length || 0;
      } catch (error) {
        this.logger.error(`Bulk index failed: ${error}`);
        failed = products.length;
      }
    }

    this.logger.log(`Reindex complete: ${indexed} indexed, ${failed} failed out of ${products.length}`);
    return { indexed, failed };
  }

  private async buildDocument(product: any): Promise<any | null> {
    const full = await this.prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        seller: { include: { user: true } },
        certifications: { include: { standard: true }, where: { status: 'verified' } },
        variants: { include: { inventory: true } },
      },
    });

    if (!full) return null;
    return this.buildDocumentFromRelations(full);
  }

  private buildDocumentFromRelations(product: any): any {
    const inStock = product.variants?.some((v: any) =>
      v.inventory?.quantityAvailable > 0,
    ) || false;

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      brand: product.brand,
      category_id: product.categoryId,
      category_name: product.category?.name,
      category_path: product.category?.path,
      seller_id: product.sellerId,
      seller_name: product.seller?.legalName,
      seller_rating: product.seller?.ratingAvg ? Number(product.seller.ratingAvg) : 0,
      base_price: Number(product.basePrice),
      currency: product.currency,
      status: product.status,
      rating_avg: product.ratingAvg ? Number(product.ratingAvg) : 0,
      rating_count: product.reviewCount || 0,
      certification_standards: product.certifications?.map((c: any) => c.standard?.code) || [],
      in_stock: inStock,
      created_at: product.createdAt,
    };
  }

  private buildSort(sort?: SearchSort): any[] {
    switch (sort) {
      case SearchSort.price_asc:
        return [{ base_price: 'asc' }, { _id: 'asc' }];
      case SearchSort.price_desc:
        return [{ base_price: 'desc' }, { _id: 'asc' }];
      case SearchSort.rating:
        return [{ rating_avg: 'desc' }, { _id: 'asc' }];
      case SearchSort.newest:
        return [{ created_at: 'desc' }, { _id: 'asc' }];
      case SearchSort.relevance:
      default:
        return [{ _score: 'desc' }, { _id: 'asc' }];
    }
  }
}
