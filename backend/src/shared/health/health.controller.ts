import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';

interface HealthCheckResult {
  status: 'ok' | 'error';
  checks?: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

@ApiTags('Health')
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('healthz')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readyz')
  @ApiOperation({ summary: 'Readiness probe — checks database and Redis' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReady(): Promise<HealthCheckResult> {
    let databaseOk = false;
    let redisOk = false;

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      databaseOk = true;
    } catch (err) {
      this.logger.error('Database readiness check failed', err);
    }

    try {
      const pong = await this.redis.getClient().ping();
      redisOk = pong === 'PONG';
    } catch (err) {
      this.logger.error('Redis readiness check failed', err);
    }

    const result: HealthCheckResult = {
      status: databaseOk && redisOk ? 'ok' : 'error',
      checks: {
        database: databaseOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    };

    if (result.status === 'error') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
