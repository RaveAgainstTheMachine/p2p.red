#!/bin/bash

# P2P File Share - Metadata API Deployment Script
# Deploys PostgreSQL, Redis, and Metadata API server

set -e

echo "🚀 P2P Metadata API Deployment"
echo "================================"

# Check if .env file exists
if [ ! -f metadata-api/.env ]; then
    echo "⚠️  Creating .env file from template..."
    cp metadata-api/.env.example metadata-api/.env
    echo "📝 Please edit metadata-api/.env with your configuration"
    echo "   Especially set a secure POSTGRES_PASSWORD"
    read -p "Press enter to continue after editing .env file..."
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose -f docker-compose.metadata.yml build

echo "🚀 Starting services..."
docker-compose -f docker-compose.metadata.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
docker-compose -f docker-compose.metadata.yml exec -T postgres pg_isready -U p2p_api_user -d p2p_metadata || {
    echo "❌ PostgreSQL is not ready"
    exit 1
}
echo "✅ PostgreSQL is healthy"

# Check Redis
echo "🔍 Checking Redis..."
docker-compose -f docker-compose.metadata.yml exec -T redis redis-cli ping || {
    echo "❌ Redis is not ready"
    exit 1
}
echo "✅ Redis is healthy"

# Check API server
echo "🔍 Checking Metadata API..."
sleep 5
curl -f http://localhost:3001/health || {
    echo "❌ Metadata API is not responding"
    docker-compose -f docker-compose.metadata.yml logs metadata-api
    exit 1
}
echo "✅ Metadata API is healthy"

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📊 Service URLs:"
echo "   - Metadata API: http://localhost:3001"
echo "   - PostgreSQL:   localhost:5432"
echo "   - Redis:        localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   - View logs:    docker-compose -f docker-compose.metadata.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.metadata.yml down"
echo "   - Restart:      docker-compose -f docker-compose.metadata.yml restart"
echo ""
echo "🔍 Test the API:"
echo "   curl http://localhost:3001/health"
echo ""
