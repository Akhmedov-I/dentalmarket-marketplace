# Agent Task — Verify, Complete & Deploy DentalMarket to a Test Environment

**Input:** the repository you produced from `DentalMarket_Technical_Specification.md` (v1.0). Treat that specification as the contract for this task.

**Claimed state:** implementation complete. **Actual goal of this task:** prove that claim, close whatever is missing, and hand back a **running, seeded, smoke-tested test deployment** that a human can open in a browser and exercise end-to-end — with **zero real payment, SMS, or cloud credentials** required.

Work the phases strictly in order. Do not start a later phase while a `BLOCKER` from an earlier phase is open.

---

## Ground rules (read before doing anything)

1. **Never weaken an invariant to make a test pass.** If a ledger, escrow, certification-gating, RBAC, or idempotency test fails, fix the implementation — never the assertion.  
2. All external integrations (payments, SMS, email, certification registries, object storage) must run as **mock/sandbox adapters behind the existing provider interfaces** (`PaymentProvider`, `SmsProvider`, registry validator, S3 client). A mock is just another adapter — no `if (testMode)` conditionals scattered through business logic. Every mock adapter must **refuse to load when `NODE_ENV=production`** (and a test must prove that guard).  
3. **No real secrets anywhere in the repo.** Everything needed to run must be generatable locally (`.env.test.example` plus a bootstrap script that creates JWT keys, webhook signing secrets, MinIO credentials).  
4. Migrations: expand-then-contract only; never edit an already-applied migration — add new ones.  
5. Conventional commits; one PR (or clearly separated commit series) per phase; CI green before moving to the next phase.  
6. Every phase ends with a written artifact (see Deliverables). Reports are part of the work, not optional.

---

## Phase 1 — Audit the implementation against the specification → `GAP_REPORT.md`

Starting from a **clean clone** on a machine with only Docker, Node 20, and pnpm/npm:

1. **Boot check:** install → typecheck → lint → unit tests → integration tests (ephemeral PostgreSQL \+ Redis via Testcontainers or compose). Record every failure verbatim with the command that produced it.  
2. **Module inventory:** verify the spec §3.3 layout exists and is actually wired: `auth, users, catalog, certification, search, cart, orders, payments, disputes, reviews, notifications, admin, reporting` plus `/workers`. Flag any module that is a stub, partial, or absent.  
3. **Database conformance (spec §4):** apply all migrations to a fresh PostgreSQL 16 and verify with real queries that:  
   - `ledger_entries` is append-only (no UPDATE/DELETE code path; enforced by trigger or revoked privileges);  
   - `escrow_holds` carries the unique partial index guaranteeing exactly one terminal state;  
   - the certification-gating guard exists: a product cannot transition to `active` unless every standard in its category's `required_standard_ids` is covered by a `verified`, unexpired certification — enforced at the database level, not only in application code;  
   - all monetary columns are BIGINT minor units \+ `currency`; **no floating point anywhere in money math**;  
   - monthly partitioning exists (or is scripted) for `ledger_entries`, `notifications`, `audit_logs`.  
4. **API conformance (spec §5):** export the OpenAPI document and diff implemented routes against the §5 tables (public/auth, customer, seller, admin). Verify: auth guards on every protected route; RBAC plus resource-ownership checks; `Idempotency-Key` enforced on `POST /orders` and all payment/refund/payout routes; the §11.4 error envelope (including `request_id`) on every error; payment webhooks signature-verified and idempotent.  
5. **Critical tests (spec §11.2):** confirm tests exist and pass for: ledger zero-sum per payment; no-oversell under concurrent checkout; certification gating at both API and DB level; the authorization matrix (seller A vs seller B isolation, buyer isolation, admin sub-role scoping); duplicate-webhook idempotency. Anything missing is a gap.  
6. **Workers:** expiry-scan, escrow auto-release, search index sync, notification dispatch, nightly reconciliation — present, scheduled, and tested?  
7. Write **`GAP_REPORT.md`**: a findings table with severity `BLOCKER` (breaks money, certification trust, auth, or boot), `MAJOR` (spec feature missing or incorrect), `MINOR` (polish) — each with exact file paths and a reproduction command.

## Phase 2 — Close the gaps

Fix every `BLOCKER` and `MAJOR`. For each: write or cite the failing test first, then the fix, then green CI. Add a "Resolution" column to `GAP_REPORT.md`. `MINOR` items may be deferred into `BACKLOG.md` with one-line rationale.

## Phase 3 — Compose the test environment

Produce a single-command, credential-free stack:

1. **`docker-compose.test.yml`** with services: `api`, `workers`, `web` (Next.js), `postgres:16`, `redis:7`, `opensearch`, `rabbitmq` (with management UI), `minio` (S3 API, bucket bootstrap included), `mailpit` (SMTP sink \+ web UI), and `caddy` or `traefik` as reverse proxy with TLS.  
2. **Mock adapters** behind the real interfaces:  
   - `MockPaymentProvider` — deterministic outcomes by card number (e.g., `…0000` approves; `…0002` declines; `…0044` approves and is intended for the dispute scenario). It must emit **signed webhooks back to the API exactly like a real PSP**, and support `refund` and `payout` calls.  
   - `MockSmsProvider` — writes OTPs and messages to logs and to Mailpit so a human can read them.  
   - `MockRegistryValidator` — returns match/no-match per a seed fixture so `registry_api` certification verification is fully testable.  
3. **`.env.test.example`** listing every variable with safe defaults, plus `scripts/bootstrap-test-env.sh` to generate local secrets.  
4. **Idempotent seed** (`pnpm seed:test`) creating:  
   - admin, compliance, and finance users (MFA pre-enrolled; print TOTP seeds to the console and into `README-TEST.md`);  
   - **Seller A**: KYC-approved, verified certifications, 12 `active` products across at least 4 categories — including one product whose certification **expires in 3 days** (for the expiry-worker test);  
   - **Seller B**: KYC `pending`, 3 products blocked by certification gating;  
   - a buyer with one order in each state (`pending_payment, paid, shipped, delivered, completed, disputed, refunded`) whose ledger entries **sum to zero per payment**;  
   - one open dispute with a message thread; reviews on delivered items; the category tree with `required_standard_ids`; the §4.3 certification standards; and the OpenSearch index built from all of it.  
5. **Make targets:** `make test-up`, `make test-seed`, `make test-smoke`, `make test-reset`, `make test-logs`.

## Phase 4 — Deploy to the test host

Default target: **one Linux host with Docker** — a local machine or a VPS; identical artifacts either way.

1. `make deploy-test HOST=<ssh-host>` (or documented manual steps): sync the compose bundle, build/pull images, bring the stack up, run migrations and seed.  
2. TLS via Caddy/Traefik — Let's Encrypt automatically if `TEST_DOMAIN` is set, self-signed otherwise.  
3. A **health-verification script** asserting: `/healthz` and `/readyz` green; workers connected to RabbitMQ and consuming; OpenSearch document count matches the seed; Mailpit reachable; the web app renders the seeded catalogue.  
4. Write **`README-TEST.md`**: all URLs (web, API, Mailpit, RabbitMQ management, MinIO console), every demo credential including TOTP seeds, the mock-payment card matrix, how to reset/reseed, how to read OTPs, and known limitations.  
5. **Mobile:** ensure the iOS and Android apps build and run in simulator/emulator against this deployment's `API_BASE_URL` (document the one-line config change). Store distribution (TestFlight / Play internal track) is **out of scope** — human-gated.

## Phase 5 — Smoke / E2E proof against the deployed stack → `SMOKE_REPORT.md`

Automate the golden path with Playwright (web) plus direct API/DB assertions, capturing screenshots and traces. Run it against the **deployed** environment, not localhost CI.

1. Admin logs in (with MFA) → approves Seller B's KYC.  
2. Seller B uploads a certification → compliance verifies it (one certificate manually, one via `MockRegistryValidator`) → the blocked product becomes listable → seller publishes → product appears in search **with its certification facet**.  
3. Buyer registers (OTP read from the mock SMS sink) → searches by certification standard \+ price facet → cart → checkout quote → places the order with an `Idempotency-Key` → pays with `…0000` → webhook arrives → order `paid`, escrow `held`, and ledger rows `capture` \+ `escrow_hold` are correct **to the minor unit**.  
4. Seller ships with tracking → buyer confirms delivery → escrow `released`; `commission` and `seller_payable` ledger entries written; payout `scheduled`.  
5. A second order paid with `…0044` → buyer opens a `not_as_described` dispute → escrow freezes → admin resolves with a **partial refund** → ledger nets to zero across release \+ refund; the mock refund completes; both parties receive notifications (visible in Mailpit and in-app).  
6. Buyer reviews the delivered item → moderation → published → seller rating recalculates.  
7. **Negative assertions:**  
   - a replayed payment webhook is a no-op (no duplicate ledger rows);  
   - Seller A receives `403` on Seller B's order;  
   - running the expiry worker delists the 3-day-expiry product and notifies the seller;  
   - checkout with `…0002` fails cleanly with the §11.4 error envelope and a retryable message;  
   - a second `confirm-delivery` cannot double-release the escrow.  
8. Write **`SMOKE_REPORT.md`**: pass/fail per step, timings, artifact links, and a final **ledger trial balance** over all seeded plus smoke-generated payments — it must net to zero.

---

## Acceptance criteria — definition of done

- Fresh clone → `make test-up && make test-seed && make test-smoke` is fully green with **no real credentials**.  
- Zero open `BLOCKER` or `MAJOR` findings in `GAP_REPORT.md`.  
- Unit \+ integration suites green; the payment/escrow/ledger module at **100% line coverage**; backend overall ≥ 80%.  
- All Phase-5 steps pass against the deployed environment.  
- `README-TEST.md` is sufficient for a non-author human to log into every panel (admin, compliance, seller, buyer) and repeat the golden path manually in under 30 minutes.  
- A test proves no mock adapter can load when `NODE_ENV=production`.

## Out of scope — human-gated (do not attempt; record in `BACKLOG.md` if blocking)

Real PSP sandbox credentials (Payme / Click / Uzcard / Stripe); real SMS gateway keys; production in-country hosting; domain/DNS purchase; Apple/Google developer accounts and store tracks; all Phase-0 legal items from the specification.

## Deliverables checklist

- [ ] `GAP_REPORT.md` (with resolutions) and `BACKLOG.md`  
- [ ] `docker-compose.test.yml` \+ mock adapters \+ bootstrap \+ idempotent seed  
- [ ] Make targets: `test-up / test-seed / test-smoke / test-reset / test-logs / deploy-test`  
- [ ] Deployed, reachable test environment (TLS, health checks green)  
- [ ] `README-TEST.md`  
- [ ] `SMOKE_REPORT.md` — all green, ledger trial balance \= 0

