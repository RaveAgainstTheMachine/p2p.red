FROM node:18-alpine

WORKDIR /app

# Install CA certificates for HTTPS status checks
RUN apk add --no-cache ca-certificates

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY server.js ./
COPY utils ./utils
COPY .env.example ./.env

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
