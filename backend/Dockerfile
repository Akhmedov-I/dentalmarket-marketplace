# ─────────────────────────────────────────
# DentalMarket API — Multi-stage Dockerfile
# ─────────────────────────────────────────

# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Install backend dependencies only
RUN pnpm install --frozen-lockfile --filter backend

# ── Stage 2: Build ──
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/ ./backend/

# Generate Prisma client
WORKDIR /app/backend
RUN npx prisma generate

# Build NestJS
RUN npx nest build

# ── Stage 3: Production ──
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY backend/prisma ./backend/prisma
COPY backend/package.json ./backend/

# Create uploads directory
RUN mkdir -p /app/backend/uploads && chown -R appuser:appgroup /app

USER appuser

WORKDIR /app/backend

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/healthz || exit 1

CMD ["node", "dist/main.js"]
