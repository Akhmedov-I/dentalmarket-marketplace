import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
    request_id: string;
  };
}

/**
 * Maps common HTTP status codes to machine-readable error codes.
 */
const HTTP_STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * Prisma known-request error structure.
 */
interface PrismaClientKnownError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

function isPrismaError(error: unknown): error is PrismaClientKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PrismaClientKnownError).code === 'string' &&
    (error as PrismaClientKnownError).code.startsWith('P')
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = request.requestId || 'unknown';

    let status: number;
    let code: string;
    let message: string;
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_STATUS_CODE_MAP[status] || 'UNKNOWN_ERROR';

      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        // class-validator returns message as array
        if (Array.isArray(resp.message)) {
          details = resp.message;
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        }
      } else {
        message = exception.message;
      }
    } else if (isPrismaError(exception)) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          code = 'UNIQUE_CONSTRAINT_VIOLATION';
          const target = (exception.meta?.target as string[]) || [];
          message = `Unique constraint violation on: ${target.join(', ')}`;
          details = [{ fields: target }];
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          code = 'RESOURCE_NOT_FOUND';
          message =
            (exception.meta?.cause as string) || 'The requested resource was not found';
          break;
        }
        default: {
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'DATABASE_ERROR';
          message = 'An unexpected database error occurred';
          break;
        }
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'An unexpected error occurred';
    }

    const errorEnvelope: ErrorEnvelope = {
      success: false,
      error: {
        code,
        message,
        details,
        request_id: requestId,
      },
    };

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} → ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorEnvelope);
  }
}
