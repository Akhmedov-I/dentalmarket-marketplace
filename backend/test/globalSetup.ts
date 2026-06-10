/**
 * Jest globalSetup for integration tests.
 *
 * Validates that Postgres and Redis are reachable before any suite runs.
 * Runs Prisma schema push to ensure the test DB is up to date.
 *
 * Shared by all integration test suites via jest.integration.config.ts.
 */
import { execSync } from 'child_process';
import { Client } from 'pg';
import Redis from 'ioredis';

export default async function globalSetup() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://dentalmarket:dentalmarket_dev@localhost:5432/dentalmarket';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // ── 1. Validate PostgreSQL ──────────────────────────────────────────────────
  const pg = new Client({ connectionString: databaseUrl });
  try {
    await pg.connect();
    const res = await pg.query('SELECT 1 AS ok');
    if (res.rows[0]?.ok !== 1) {
      throw new Error('PostgreSQL connectivity check failed');
    }
    console.log('[globalSetup] ✓ PostgreSQL is reachable');
  } catch (err: any) {
    console.error('[globalSetup] ✗ Cannot connect to PostgreSQL:', err.message);
    throw new Error(
      `Integration tests require a running PostgreSQL instance at ${databaseUrl}. ` +
        `Start services with: docker compose up -d postgres`,
    );
  } finally {
    await pg.end();
  }

  // ── 2. Validate Redis ──────────────────────────────────────────────────────
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis PING did not return PONG');
    }
    console.log('[globalSetup] ✓ Redis is reachable');
  } catch (err: any) {
    console.error('[globalSetup] ✗ Cannot connect to Redis:', err.message);
    throw new Error(
      `Integration tests require a running Redis instance at ${redisUrl}. ` +
        `Start services with: docker compose up -d redis`,
    );
  } finally {
    redis.disconnect();
  }

  // ── 3. Run Prisma db push to ensure schema is synced ────────────────────────
  try {
    console.log('[globalSetup] Running prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: __dirname + '/..',
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('[globalSetup] ✓ Prisma schema synced');
  } catch (err: any) {
    console.error('[globalSetup] ✗ Prisma db push failed:', err.stderr?.toString() || err.message);
    throw err;
  }

  // ── 4. Run Prisma seed (idempotent) ─────────────────────────────────────────
  try {
    console.log('[globalSetup] Running prisma db seed...');
    execSync('npx prisma db seed', {
      cwd: __dirname + '/..',
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('[globalSetup] ✓ Database seeded');
  } catch (err: any) {
    // Seed may fail if data exists — that's OK for idempotent seeds
    console.log('[globalSetup] ⚠ Seed warning (non-fatal):', err.stderr?.toString()?.slice(0, 200) || err.message);
  }
}
