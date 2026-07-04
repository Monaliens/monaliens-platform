# Use Node.js 20 LTS for maximum performance
FROM node:20-bullseye AS base

# Install system dependencies and yarn for faster builds
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    curl \
    && curl -fsSL https://yarnpkg.com/install.sh | bash \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.yarn/bin:/root/.config/yarn/global/node_modules/.bin:$PATH"

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* ./

# Use yarn if available, otherwise npm with ultra optimizations
RUN if [ -f yarn.lock ]; then \
      yarn install --production --frozen-lockfile --network-timeout 300000; \
    elif [ -f package-lock.json ]; then \
      npm ci --only=production --no-audit --no-fund --maxsockets 20 --prefer-offline; \
    else \
      npm install --only=production --no-audit --no-fund --maxsockets 20; \
    fi && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package.json yarn.lock* package-lock.json* ./
RUN if [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile --network-timeout 300000; \
    elif [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund --maxsockets 20 --prefer-offline; \
    else \
      npm install --no-audit --no-fund --maxsockets 20; \
    fi && npm cache clean --force

COPY . .
RUN npm run build

# Production image - ultra slim
FROM node:20-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/src/contracts ./src/contracts

USER nodejs

EXPOSE 3021

CMD ["node", "dist/server.js"] 