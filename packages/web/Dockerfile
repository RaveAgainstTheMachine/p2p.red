# Use the official Node.js runtime as a parent image
FROM node:22-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy the entire workspace for pnpm to resolve dependencies
COPY .. .
COPY . ./packages/web/

# Install pnpm
RUN npm install -g pnpm

# Build-time env for Vite
ARG VITE_API_URL
ARG VITE_PEERJS_HOST
ARG VITE_PEERJS_PORT
ARG VITE_PEERJS_SECURE
ARG VITE_BUILD_VARIANT

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PEERJS_HOST=$VITE_PEERJS_HOST
ENV VITE_PEERJS_PORT=$VITE_PEERJS_PORT
ENV VITE_PEERJS_SECURE=$VITE_PEERJS_SECURE
ENV VITE_BUILD_VARIANT=$VITE_BUILD_VARIANT

# Install dependencies from workspace root
WORKDIR /app
RUN pnpm install

# Build the application
RUN cd packages/web && pnpm run build

# Production stage - use simple HTTP server
FROM node:22-alpine

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
