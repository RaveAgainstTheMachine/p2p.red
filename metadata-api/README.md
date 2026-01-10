# P2P File Share - Metadata API

High-performance metadata storage API for generating short share links.

## Architecture

```
Frontend → Nginx → Metadata API → Redis (Cache) → PostgreSQL (Persistence)
```

## Features

- **Short Link Generation**: 8-character Base62 encoded keys
- **High Performance**: Redis caching for sub-10ms reads
- **Scalable**: PostgreSQL for reliable persistence
- **Auto-Expiry**: Links expire after 24 hours (configurable)
- **Rate Limiting**: Protection against abuse
- **Health Checks**: Built-in monitoring endpoints
- **Analytics**: Track link access counts

## Quick Start

### 1. Configure Environment

```bash
cd metadata-api
cp .env.example .env
# Edit .env with your configuration
```

### 2. Deploy Services

```bash
cd ..
./deploy-metadata-api.sh
```

### 3. Verify Deployment

```bash
curl http://localhost:3001/health
```

## API Endpoints

### Create Short Link

**POST** `/api/metadata`

Request:
```json
{
  "peerId": "f8366afb-88aa-4c7d-adf5-89847043ace6",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "fileType": "application/pdf"
}
```

Response:
```json
{
  "key": "aB3xK9mP",
  "expiresAt": "2024-01-11T12:00:00.000Z"
}
```

### Retrieve Metadata

**GET** `/api/metadata/:key`

Response:
```json
{
  "peerId": "f8366afb-88aa-4c7d-adf5-89847043ace6",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "fileType": "application/pdf"
}
```

### Health Check

**GET** `/health`

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "services": {
    "postgres": "connected",
    "redis": "connected"
  }
}
```

### Statistics

**GET** `/api/stats`

Response:
```json
{
  "total_links": 1234,
  "active_links": 567,
  "total_accesses": 5678,
  "avg_file_size": 10485760
}
```

## Performance Targets

- **Read Latency**: <10ms (Redis cache hit)
- **Write Latency**: <50ms
- **Throughput**: 10,000+ requests/second
- **Cache Hit Rate**: >95%
- **Availability**: 99.9%+

## Database Schema

```sql
CREATE TABLE short_links (
    id BIGSERIAL PRIMARY KEY,
    short_key VARCHAR(8) UNIQUE NOT NULL,
    peer_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE
);
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | 3001 |
| `POSTGRES_HOST` | PostgreSQL host | postgres |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |
| `POSTGRES_DB` | Database name | p2p_metadata |
| `POSTGRES_USER` | Database user | p2p_api_user |
| `POSTGRES_PASSWORD` | Database password | (required) |
| `REDIS_HOST` | Redis host | redis |
| `REDIS_PORT` | Redis port | 6379 |
| `LINK_EXPIRY_HOURS` | Link expiration time | 24 |
| `CLEANUP_INTERVAL_MINUTES` | Cleanup job interval | 60 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## Monitoring

### View Logs

```bash
docker-compose -f docker-compose.metadata.yml logs -f metadata-api
```

### Check Service Status

```bash
docker-compose -f docker-compose.metadata.yml ps
```

### Database Queries

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.metadata.yml exec postgres psql -U p2p_api_user -d p2p_metadata

# View active links
SELECT short_key, file_name, created_at, expires_at FROM short_links WHERE expires_at > NOW();

# View statistics
SELECT COUNT(*) as total, SUM(access_count) as accesses FROM short_links;
```

### Redis Monitoring

```bash
# Connect to Redis
docker-compose -f docker-compose.metadata.yml exec redis redis-cli

# View cached keys
KEYS link:*

# Check cache stats
INFO stats
```

## Scaling

### Horizontal Scaling

1. Deploy multiple API server instances
2. Use Nginx load balancing
3. Configure shared PostgreSQL and Redis

### Vertical Scaling

- Increase PostgreSQL connection pool size
- Allocate more memory to Redis
- Increase worker processes

## Security

- Rate limiting on all endpoints
- CORS configuration
- Helmet.js security headers
- Input validation
- SQL injection prevention (parameterized queries)

## Troubleshooting

### API Not Responding

```bash
# Check logs
docker-compose -f docker-compose.metadata.yml logs metadata-api

# Restart service
docker-compose -f docker-compose.metadata.yml restart metadata-api
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.metadata.yml exec postgres pg_isready

# View PostgreSQL logs
docker-compose -f docker-compose.metadata.yml logs postgres
```

### Redis Connection Issues

```bash
# Check Redis status
docker-compose -f docker-compose.metadata.yml exec redis redis-cli ping

# View Redis logs
docker-compose -f docker-compose.metadata.yml logs redis
```

## Maintenance

### Backup Database

```bash
docker-compose -f docker-compose.metadata.yml exec postgres pg_dump -U p2p_api_user p2p_metadata > backup.sql
```

### Restore Database

```bash
docker-compose -f docker-compose.metadata.yml exec -T postgres psql -U p2p_api_user p2p_metadata < backup.sql
```

### Clean Up Expired Links

Automatic cleanup runs every hour. Manual cleanup:

```bash
docker-compose -f docker-compose.metadata.yml exec postgres psql -U p2p_api_user -d p2p_metadata -c "SELECT cleanup_expired_links();"
```

## License

MIT
