import type { Config } from 'jest';

/**
 * Jest config for UNIT tests.
 *
 * - No DB, no Redis, no containers — pure logic tests
 * - Runs in parallel (default Jest workers)
 * - Must complete in < 60 s
 * - Matches *.unit.spec.ts files to distinguish from integration specs
 */
const config: Config = {
  // ── Paths ──────────────────────────────────────────────────────────────────
  rootDir: '../src',
  testRegex: '.*\\.unit\\.spec\\.ts$',

  // ── Timeout: tighter for pure logic ────────────────────────────────────────
  testTimeout: 5_000,

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
  coverageDirectory: '../coverage-unit',
};

export default config;
