# Use the official Node.js runtime as a parent image
FROM node:20-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy the entire workspace for pnpm to resolve dependencies
COPY .. .
COPY . ./packages/web/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies from workspace root
WORKDIR /app
RUN pnpm install

# Build the application
RUN cd packages/web && pnpm run build

# Production stage - use simple HTTP server
FROM node:20-alpine

# Install simple HTTP server
RUN npm install -g http-server

# Copy built application
COPY --from=builder /app/packages/web/dist /app

# Create health check script
RUN echo 'echo "healthy"' > /app/health.sh && chmod +x /app/health.sh

# Expose port 3000
EXPOSE 3000

# Start HTTP server
CMD ["sh", "-c", "http-server /app -p 3000 --cors"]
