# DentalMarket — Test Environment Setup

## Prerequisites

- **Docker** (Docker Desktop or Docker Engine + Compose V2)
- **Node.js** ≥ 20 LTS
- **pnpm** ≥ 9 (`corepack enable && corepack prepare pnpm@9 --activate`)

## Quick Start (Development)

```bash
# 1. Clone and install
git clone <repo-url> && cd online_store
pnpm install

# 2. Start infrastructure
docker compose up -d

# 3. Wait for services, then set up database
cd backend
cp ../.env.example .env          # Adjust DATABASE_URL if needed
npx prisma db push               # Sync schema
npx ts-node prisma/apply-constraints.ts  # Apply triggers/indexes
npx prisma db seed                # Seed reference data

# 4. Start the API
npm run dev
```

API is available at: **http://localhost:3000/api/v1**  
Swagger docs: **http://localhost:3000/api/docs**

## Running Tests

### Using Makefile (recommended)

```bash
make test-run        # Run all tests (unit + integration)
make test-smoke      # Integration tests only
make test-reset      # Reset test environment
```

### Manual

```bash
cd backend
npm run test         # All tests (unit → integration, sequential)
npm run test:unit    # Unit tests only (parallel, no DB needed)
npm run test:integration  # Integration tests (requires DB + Redis running)
```

### Test Configuration

| Script | Config | Workers | Timeout | Requires |
|--------|--------|---------|---------|----------|
| `test:unit` | `jest.unit.config.ts` | Parallel | 15s | Nothing |
| `test:integration` | `jest.integration.config.ts` | Sequential | 15s | PostgreSQL + Redis |
| `test` | Both above | Sequential | 15s | PostgreSQL + Redis |

## Infrastructure Services

| Service | Dev Port | Test Port | Image |
|---------|----------|-----------|-------|
| PostgreSQL | 5432 | 5433 | `postgres:16-alpine` |
| Redis | 6379 | 6380 | `redis:7-alpine` |
| OpenSearch | 9200 | 9201 | `opensearch:2.11.0` |
| RabbitMQ | 5672/15672 | — | `rabbitmq:3.13-management-alpine` |
| ClickHouse | 8123/9000 | — | `clickhouse:24.1-alpine` |

## Health Check

```bash
# Liveness
curl http://localhost:3000/api/v1/healthz
# → {"status":"ok"}

# Readiness (checks DB + Redis)
curl http://localhost:3000/api/v1/readyz
# → {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

## API Endpoints Summary

### Public
- `GET /api/v1/categories` — List categories
- `GET /api/v1/products` — List products
- `GET /api/v1/products/:id` — Product detail
- `GET /api/v1/products/:productId/reviews` — Product reviews
- `GET /api/v1/search` — Faceted search
- `GET /api/v1/search/suggest` — Autocomplete

### Auth
- `POST /api/v1/auth/register` — Create account
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh` — Refresh token
- `GET /api/v1/auth/me` — Current user

### Customer
- `GET|POST|PATCH|DELETE /api/v1/cart/*` — Cart management
- `GET|POST|DELETE /api/v1/wishlist/*` — Wishlist
- `POST /api/v1/orders` — Create order
- `GET /api/v1/orders` — My orders
- `POST /api/v1/disputes` — Raise dispute
- `POST /api/v1/reviews` — Submit review
- `GET /api/v1/me/notifications` — Notifications
- `GET /api/v1/me/reports/orders` — Order report

### Seller
- `POST|PATCH /api/v1/seller/products/*` — Manage products
- `POST /api/v1/certifications` — Upload cert
- `GET /api/v1/seller/reports/*` — Sales/financial reports

### Admin
- `GET|PATCH /api/v1/admin/users/*` — User management
- `GET|POST /api/v1/admin/sellers/*` — KYC management
- `GET|POST /api/v1/admin/disputes/*` — Dispute resolution
- `GET|POST /api/v1/admin/refunds/*` — Refund decisions
- `GET|POST /api/v1/admin/payouts/*` — Payout approval
- `GET /api/v1/admin/audit-logs` — Audit trail
- `POST /api/v1/admin/workers/*` — Trigger workers
- `GET /api/v1/admin/reports/*` — Platform analytics

## Mock Adapters

The test environment uses deterministic mock adapters:

| Adapter | Production Guard | Behavior |
|---------|-----------------|----------|
| MockPaymentProvider | ✅ Throws if NODE_ENV=production | Card `*0000` = captured, `*0002` = declined |
| MockSmsProvider | ✅ | Logs OTP to console, stores in memory |
| MockRegistryValidator | ✅ | `*VALID*` = matched, `*INVALID*` = unmatched |

## Database Constraints

| Constraint | Type | Purpose |
|-----------|------|---------|
| `enforce_ledger_append_only` | Trigger | Blocks UPDATE/DELETE on `ledger_entries` |
| `enforce_audit_log_append_only` | Trigger | Blocks UPDATE/DELETE on `audit_logs` |
| `enforce_cert_verify_append_only` | Trigger | Blocks UPDATE/DELETE on `certification_verifications` |
| `enforce_product_cert_gating` | Trigger | Prevents product activation without valid certs |
| `chk_*_positive` | CHECK | Non-negative monetary amounts |
| `idx_escrow_terminal_state` | Partial unique | Exactly one terminal escrow state |

## Build & Deploy

```bash
# Build Docker image
make build
# → dentalmarket-api:latest

# Run with dev infrastructure
make build-run
```
