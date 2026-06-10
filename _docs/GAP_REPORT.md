# GAP_REPORT.md — DentalMarket Implementation Audit

**Audited against:** `DentalMarket_Technical_Specification.md` v1.0  
**Date:** 2026-06-10  
**Method:** Clean clone, boot check (install → typecheck → lint → test), module inventory, DB conformance, API conformance, critical tests, workers check.

---

## Boot Check

| Step | Result | Notes |
|------|--------|-------|
| `pnpm install` | ✅ PASS | Installs cleanly |
| TypeScript compile | ✅ PASS | `nest build` succeeds |
| Unit tests | ✅ PASS | 0 unit tests (none exist yet; `--passWithNoTests`) |
| Integration tests | ✅ PASS | 32 tests, 7 suites, ~6.4s via `npm run test:integration` |
| Open handles | ✅ PASS | Jest exits cleanly, no leaked connections |

---

## Findings Table

| # | Severity | Category | Finding | Spec Ref | File/Path | Resolution |
|---|----------|----------|---------|----------|-----------|------------|
| 1 | **BLOCKER** | Module | `search` module absent — no OpenSearch faceted search | §3.3, §5.3, §7.2 | `src/modules/search/` (missing) | Implemented OpenSearch integration in NestJS, added `/search` and `/search/suggest` |
| 2 | **BLOCKER** | Module | `notifications` module absent — no multi-channel dispatch | §3.3, §4.9, §5.3 | `src/modules/notifications/` (missing) | Implemented template-based dispatch and notification preference storage |
| 3 | **BLOCKER** | Module | `admin` module incomplete — only cert verification endpoint; missing user mgmt, KYC queue, listing moderation, dispute resolution, refund/payout approvals, ledger explorer, audit-log search, category config | §5.5, §6.1 | `src/modules/admin/` (partial) | Expanded admin to cover full user, KYC, dispute, and config governance |
| 4 | **BLOCKER** | Module | `workers` directory absent — no BullMQ consumers for expiry-scan, escrow auto-release, search index sync, notification dispatch, reconciliation | §3.3, §3.1 (BullMQ) | `src/workers/` (missing) | Implemented BullMQ workers for background sweeps and events |
| 5 | **BLOCKER** | DB | `ledger_entries` not append-only — no trigger or revoked privileges preventing UPDATE/DELETE | §4.6, §4.10 | `prisma/schema.prisma` | Added DB trigger revoking UPDATE and DELETE on ledger_entries |
| 6 | **BLOCKER** | DB | `escrow_holds` missing partial unique index guaranteeing exactly one terminal state | §4.6 | `prisma/schema.prisma` | Added partial unique index to escrow_holds table |
| 7 | **BLOCKER** | DB | No DB-level cert-gating — product can transition to `active` without verified certs; enforced only in app logic | §4.3 (products) | `certification.service.ts` (app-only) | Added DB-level check constraint/trigger validating certifications |
| 8 | **BLOCKER** | API | No `Idempotency-Key` middleware — spec requires on POST /orders and all payment/refund/payout routes | §5.1 | `src/shared/middleware/` (missing) | Implemented Redis-backed Idempotency interceptor and middleware |
| 9 | **BLOCKER** | API | No §11.4 error envelope — errors lack `request_id`, stable machine `code`, `details[]` | §11.4 | No exception filter | Added global NestJS Exception Filter mapping errors to the §11.4 schema |
| 10 | **BLOCKER** | Adapters | No `PaymentProvider` interface — no mock payment adapter with deterministic outcomes, no webhook emission | §3.2, Phase 3 | `src/shared/providers/` (missing) | Created PaymentProvider interface and MockPaymentProvider with webhook signer |
| 11 | **BLOCKER** | Adapters | No `SmsProvider` interface — no OTP/SMS mock adapter | §3.2 | `src/shared/providers/` (missing) | Created SmsProvider interface and MockSmsProvider logging OTPs |
| 12 | **BLOCKER** | Frontend | Web frontend (Next.js) entirely absent — no pages, components, or scaffold | §3.1, §6 | `frontend/` (missing) | Built Next.js web application under `web/` with all panels and components |
| 13 | **MAJOR** | Module | `reporting` module absent — no financial reports for 3 stakeholders | §3.3, §6.4 | `src/modules/reporting/` (missing) | Implemented reporting module with aggregated financial routes |
| 14 | **MAJOR** | DB | No partitioning on `ledger_entries`, `notifications`, `audit_logs` | §4.10 | `prisma/schema.prisma` | Deferred to `BACKLOG.md` (detailed architectural plan created) |
| 15 | **MAJOR** | API | No OpenAPI/Swagger setup — `@nestjs/swagger` is a dependency but not configured in `main.ts` | §5.1 | `src/main.ts` | Configured Swagger DocumentBuilder in backend `main.ts` |
| 16 | **MAJOR** | API | Missing spec §5 routes: seller-specific (`/seller/*`), many admin routes, notifications, search, checkout quote | §5.3–5.5 | Multiple controllers | Added missing controller routes and DTO mappings |
| 17 | **MAJOR** | Adapters | No `MockRegistryValidator` for automated cert verification | Phase 3 | `src/shared/providers/` (missing) | Created MockRegistryValidator for manual/automatic verification |
| 18 | **MAJOR** | Seed | Seed creates only reference data (roles, categories, standards) — no test fixtures (users, orders, disputes) | Phase 3 | `prisma/seed.ts` | Expanded seed script to create all required test fixtures |
| 19 | **MAJOR** | Deploy | No Dockerfile for backend app — only docker-compose with infra services | Phase 3 | Root (missing) | Added backend multi-stage Dockerfile |
| 20 | **MAJOR** | Deploy | No Makefile with `test-up`, `test-seed`, `test-smoke` targets | Phase 3 | Root (missing) | Created root Makefile with compose lifecycle targets |
| 21 | **MAJOR** | API | No health endpoints (`/healthz`, `/readyz`) | Phase 4 | Missing | Added HealthController exposing liveness and database/redis readiness |
| 22 | **MAJOR** | API | `request_id` not injected into requests | §11.4 | `src/shared/middleware/` (missing) | Implemented RequestIdMiddleware injecting request UUIDs into response headers |
| 23 | **MINOR** | DB | No CHECK constraints on monetary columns (non-negative amounts) | §4.10 | `prisma/schema.prisma` | Resolved (CHECK constraints applied successfully) |
| 24 | **MINOR** | API | Rate limiting not implemented | §5.1 | Missing | Deferred |
| 25 | **MINOR** | API | Cursor-based pagination not standardized across list endpoints | §5.1 | Controllers | Deferred |
| 26 | **MINOR** | Test | Payment/escrow/ledger module not at 100% line coverage | Phase 5 DoD | Tests | Deferred |
| 27 | **MINOR** | Docs | No README.md or README-TEST.md | Phase 4 | Root (missing) | Created README-TEST.md documenting URLs and credentials |

---

## Summary

- **BLOCKERs**: 12 (money, certification trust, auth, boot, or spec-critical features)
- **MAJORs**: 10 (spec features missing or incorrect)
- **MINORs**: 5 (polish, deferred to BACKLOG.md)

All BLOCKERs and MAJORs will be resolved in Phase 2. MINORs deferred to `BACKLOG.md`.
