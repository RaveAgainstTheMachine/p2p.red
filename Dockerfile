FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build-time build variant for badge
ARG VITE_BUILD_VARIANT
ENV VITE_BUILD_VARIANT=$VITE_BUILD_VARIANT

# Build application
RUN pnpm run build

# Production stage
FROM node:20-alpine

ARG VITE_BUILD_VARIANT
LABEL p2p.build_variant=$VITE_BUILD_VARIANT

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
