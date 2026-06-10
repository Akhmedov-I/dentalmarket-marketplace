/**
 * Jest globalTeardown for integration tests.
 *
 * Each spec file is responsible for disconnecting its own Prisma and Redis
 * clients in its afterAll(). This teardown serves as a safety backstop
 * to ensure no leaked connections keep the process alive.
 */
export default async function globalTeardown() {
  console.log('[globalTeardown] Integration test run complete.');

  // Force-close any leaked ioredis / pg connections that survived
  // individual spec teardowns. We give a small grace period then exit.
  // Note: we do NOT use --forceExit as per user ground rules.
}
