FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build-time build metadata for badge
ARG VITE_BUILD_VARIANT
ARG VITE_BUILD_VERSION
ARG VITE_API_URL
ARG VITE_PEERJS_HOST
ARG VITE_PEERJS_PORT
ARG VITE_PEERJS_SECURE
ENV VITE_BUILD_VARIANT=$VITE_BUILD_VARIANT
ENV VITE_BUILD_VERSION=$VITE_BUILD_VERSION
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PEERJS_HOST=$VITE_PEERJS_HOST
ENV VITE_PEERJS_PORT=$VITE_PEERJS_PORT
ENV VITE_PEERJS_SECURE=$VITE_PEERJS_SECURE

# Build application
RUN npm run build && \
    mkdir -p dist/download-bridge && \
    cp -f public/download-bridge/bridge.html dist/download-bridge/bridge.html && \
    cp -f public/download-bridge/bridge.js dist/download-bridge/bridge.js && \
    cp -f public/download-bridge/sw.js dist/download-bridge/sw.js

# Production stage
FROM node:22-alpine

ARG VITE_BUILD_VARIANT
ARG VITE_BUILD_VERSION
LABEL p2p.build_variant=$VITE_BUILD_VARIANT
LABEL p2p.build_version=$VITE_BUILD_VERSION

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/serve.json ./serve.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
