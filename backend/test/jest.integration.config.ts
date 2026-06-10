import type { Config } from 'jest';

/**
 * Jest config for INTEGRATION tests.
 *
 * - Runs sequentially (--runInBand is forced in the npm script)
 * - Uses shared Postgres + Redis (validated in globalSetup)
 * - testTimeout = 15 s so a dead dependency fails fast
 * - Matches only *.spec.ts files (all current tests are integration)
 */
const config: Config = {
  // ── Paths ──────────────────────────────────────────────────────────────────
  rootDir: '../src',
  testRegex: '.*\\.spec\\.ts$',

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  globalSetup: '<rootDir>/../test/globalSetup.ts',
  globalTeardown: '<rootDir>/../test/globalTeardown.ts',

  // ── Timeout: 15 s so a dead DB fails fast instead of hanging ────────────
  testTimeout: 15_000,

  // ── Transform ──────────────────────────────────────────────────────────────
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!uuid)/'],

  // ── Module resolution (mirrors tsconfig paths) ────────────────────────────
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },

  // ── Environment ────────────────────────────────────────────────────────────
  testEnvironment: 'node',

  // ── Coverage ───────────────────────────────────────────────────────────────
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};

export default config;
