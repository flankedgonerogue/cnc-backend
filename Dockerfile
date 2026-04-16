# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
# Prisma requires openssl for Alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
# Install all dependencies (including dev for building)
RUN npm ci

# --- Stage 2: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
# Provide dummy DATABASE_URL to satisfy prisma.config.ts during build
RUN DATABASE_URL=postgresql://dummy npx prisma generate
# Build the NestJS app
RUN npm run build
# Remove devDependencies to prepare for production
# npm prune is faster than reinstalling
ENV NODE_ENV=production
RUN npm prune --omit=dev

# --- Stage 3: Runner (Minimal Final Image) ---
FROM node:22-alpine AS runner
# Install openssl for Prisma query engine in production
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user for security
USER node

# Copy only what is necessary from the builder stage
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
