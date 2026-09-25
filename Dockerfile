# =============================================================================
# PULSE-RTIP backend + web frontend image (used by Railway)
# =============================================================================
# Only the backend, database scripts and web frontend are shipped; the
# Electron / Capacitor tooling at the repo root is not needed on a server.

# ---- Build stage: compile native deps (better-sqlite3) ----------------------
FROM node:22-bookworm-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/src/backend
COPY src/backend/package.json src/backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage -----------------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/src/backend/node_modules ./src/backend/node_modules
COPY src/backend ./src/backend
COPY src/database/migrations ./src/database/migrations
COPY src/database/seeds ./src/database/seeds
COPY src/frontend ./src/frontend
COPY scripts/railway-start.sh ./scripts/railway-start.sh

WORKDIR /app/src/backend
EXPOSE 3000
CMD ["sh", "/app/scripts/railway-start.sh"]
