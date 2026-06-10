# ─────────────────────────────────────────
# DentalMarket — Development & Test Makefile
# ─────────────────────────────────────────

.PHONY: help dev-up dev-down test-up test-down test-seed test-run test-smoke test-reset test-logs build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──

dev-up: ## Start development infrastructure (postgres, redis, opensearch, rabbitmq, clickhouse)
	docker compose up -d
	@echo "⏳ Waiting for services..."
	@sleep 5
	cd backend && npx prisma db push --skip-generate
	cd backend && npx ts-node prisma/apply-constraints.ts
	cd backend && npx prisma db seed
	@echo "✅ Dev environment ready"

dev-down: ## Stop development infrastructure
	docker compose down

# ── Test Environment ──

test-up: ## Start test infrastructure (isolated ports: pg:5433, redis:6380, opensearch:9201)
	docker compose -f docker-compose.test.yml up -d --wait
	@echo "✅ Test infrastructure ready"

test-down: ## Stop and remove test infrastructure (ephemeral data lost)
	docker compose -f docker-compose.test.yml down -v

test-seed: ## Push schema and seed test database
	cd backend && DATABASE_URL=postgresql://dentalmarket_test:dentalmarket_test@localhost:5433/dentalmarket_test \
		npx prisma db push --skip-generate
	cd backend && DATABASE_URL=postgresql://dentalmarket_test:dentalmarket_test@localhost:5433/dentalmarket_test \
		npx ts-node prisma/apply-constraints.ts
	cd backend && DATABASE_URL=postgresql://dentalmarket_test:dentalmarket_test@localhost:5433/dentalmarket_test \
		npx prisma db seed
	@echo "✅ Test database seeded"

test-run: ## Run all tests (unit + integration)
	cd backend && npm run test

test-smoke: ## Run integration tests only
	cd backend && npm run test:integration

test-reset: test-down test-up test-seed ## Reset test environment completely

test-logs: ## Show test infrastructure logs
	docker compose -f docker-compose.test.yml logs -f

# ── Build ──

build: ## Build the backend Docker image
	docker build -t dentalmarket-api:latest -f backend/Dockerfile .

build-run: build ## Build and run the backend container
	docker run --rm -p 3000:3000 --network dentalmarket-net \
		-e DATABASE_URL=postgresql://dentalmarket:dentalmarket_dev@postgres:5432/dentalmarket \
		-e REDIS_URL=redis://redis:6379 \
		-e OPENSEARCH_URL=http://opensearch:9200 \
		-e JWT_SECRET=change-me-in-production \
		dentalmarket-api:latest
