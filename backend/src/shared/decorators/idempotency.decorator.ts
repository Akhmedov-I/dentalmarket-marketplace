import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_REQUIRED_KEY = 'idempotency_required';

/**
 * Marks a route handler as requiring an `Idempotency-Key` header.
 * When applied, the IdempotencyInterceptor will:
 *   - Return 400 if the header is missing
 *   - Return a cached response if the key was already processed
 *   - Cache the new response for 24 hours
 */
export const IdempotencyRequired = () =>
  SetMetadata(IDEMPOTENCY_REQUIRED_KEY, true);
