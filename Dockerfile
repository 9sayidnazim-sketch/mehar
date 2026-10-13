# Multi-stage production Dockerfile for THREDO on AWS (App Runner, ECS Fargate, Lightsail)
# Stage 1: Build frontend bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend server files
COPY server ./server

# Ensure writable data directory for storage
RUN mkdir -p .data && chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 3000

# Container healthcheck for AWS ALB / App Runner
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server/server.js"]
