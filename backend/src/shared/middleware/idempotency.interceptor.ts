import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisService } from '@shared/redis/redis.service';
import { IDEMPOTENCY_REQUIRED_KEY } from '@shared/decorators/idempotency.decorator';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isRequired = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENCY_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers['idempotency-key'] as
      | string
      | undefined;

    // If the decorator is not present, still honour the header if provided
    if (!isRequired && !idempotencyKey) {
      return next.handle();
    }

    // When the decorator IS present, the header is mandatory
    if (isRequired && !idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for this endpoint',
      );
    }

    const redisKey = `idempotency:${idempotencyKey}`;

    // Check cache
    const cached = await this.redisService.get(redisKey);
    if (cached) {
      const parsed: CachedResponse = JSON.parse(cached);
      const response = context.switchToHttp().getResponse<Response>();
      response.status(parsed.statusCode);
      return of(parsed.body);
    }

    // Process request and cache the result
    return next.handle().pipe(
      tap(async (responseBody) => {
        const response = context.switchToHttp().getResponse<Response>();
        const cached: CachedResponse = {
          statusCode: response.statusCode,
          body: responseBody,
        };
        await this.redisService.set(
          redisKey,
          JSON.stringify(cached),
          IDEMPOTENCY_TTL_SECONDS,
        );
      }),
    );
  }
}
