# P2P File Share - Scaling Plan (HashiCorp Stack)

## Current State (Single VPS)
- **Orchestration**: Docker Compose
- **Capacity**: ~100 concurrent users (theoretical)
- **Infrastructure**: 1x OVH VPS (2 vCPU, 4GB RAM)
- **Cost**: ~$15/month

## Future State (Multi-VPS with HashiCorp)

### Target Scale
- **Users**: 3,000-10,000 concurrent users
- **Infrastructure**: 5-7 VPS instances
- **Cost**: $75-150/month

### HashiCorp Stack Components

#### 1. Nomad (Orchestration)
- **Purpose**: Container and service orchestration
- **Why**: Simpler than Kubernetes, runs Docker containers + native binaries
- **Deployment**: 3 server nodes (quorum), N client nodes (workers)

#### 2. Consul (Service Discovery)
- **Purpose**: Service mesh, health checks, configuration
- **Why**: Automatic service discovery, no hardcoded IPs
- **Features**: DNS-based discovery, health checks, KV store

#### 3. Vault (Optional - Secrets Management)
- **Purpose**: Manage database passwords, API keys, certificates
- **Why**: Centralized secrets, automatic rotation
- **Priority**: Implement after initial Nomad deployment

---

## Migration Path

### Phase 1: Current (Docker Compose)
**Status**: ✅ Complete
- Single VPS deployment
- All services containerized
- Envoy reverse proxy
- Working metadata API, PeerJS, TURN

### Phase 2: Nomad Preparation (Before Scaling)
**When**: After proving file transfer works, before hitting 500+ concurrent users

**Tasks**:
1. Convert Docker Compose services to Nomad job specs
2. Set up Consul for service discovery
3. Test Nomad deployment on single VPS
4. Document deployment process

**Deliverables**:
- `nomad/metadata-api.nomad` - Metadata API job spec
- `nomad/frontend.nomad` - Frontend app job spec
- `nomad/peerjs.nomad` - PeerJS signaling job spec
- `nomad/postgres.nomad` - PostgreSQL job spec
- `nomad/redis.nomad` - Redis cache job spec
- `nomad/envoy.nomad` - Envoy reverse proxy job spec
- `nomad/turn.nomad` - TURN server job spec

### Phase 3: Multi-VPS Deployment (Scaling)
**When**: Hitting 1,000+ concurrent users or need redundancy

**Infrastructure**:
```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer VPS                       │
│                  (Envoy + Consul + Nomad)                   │
│                    Public IP: <domain>                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼──────────┐
│   Web VPS 1    │   │   Web VPS 2     │   │   Web VPS 3     │
│ (Nomad Client) │   │ (Nomad Client)  │   │ (Nomad Client)  │
│                │   │                 │   │                 │
│ - Frontend     │   │ - Frontend      │   │ - Frontend      │
│ - PeerJS       │   │ - PeerJS        │   │ - PeerJS        │
│ - Metadata API │   │ - Metadata API  │   │ - Metadata API  │
└────────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Database VPS     │
                    │ (Nomad Client)     │
                    │                    │
                    │ - PostgreSQL       │
                    │ - Redis            │
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │    TURN VPS        │
                    │ (Nomad Client)     │
                    │                    │
                    │ - coturn           │
                    └────────────────────┘
```

**VPS Breakdown**:
1. **Load Balancer VPS** ($10/month)
   - Nomad server (1 of 3)
   - Consul server (1 of 3)
   - Envoy (load balancing)
   - 1 vCPU, 2GB RAM

2. **Web VPS x3** ($30-45/month total)
   - Nomad clients
   - Run: Frontend, PeerJS, Metadata API containers
   - 2 vCPU, 4GB RAM each

3. **Database VPS** ($20-30/month)
   - Nomad client
   - PostgreSQL (persistent storage)
   - Redis (cache)
   - 2 vCPU, 8GB RAM

4. **TURN VPS** ($10-20/month)
   - Nomad client
   - coturn (NAT traversal)
   - 2 vCPU, 4GB RAM

5. **Monitoring VPS** (Optional, $10-15/month)
   - Nomad server (2 of 3)
   - Consul server (2 of 3)
   - Prometheus + Grafana
   - 1 vCPU, 2GB RAM

**Total**: 5-6 VPS, $75-150/month

---

## Nomad Job Spec Example

### Metadata API (metadata-api.nomad)
```hcl
job "metadata-api" {
  datacenters = ["dc1"]
  type = "service"

  group "api" {
    count = 3  # Run 3 instances across cluster

    network {
      port "http" {
        to = 3001
      }
    }

    service {
      name = "metadata-api"
      port = "http"
      
      tags = [
        "urlprefix-/api/"
      ]

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "api-server" {
      driver = "docker"

      config {
        image = "p2p-file-share_metadata-api:latest"
        ports = ["http"]
      }

      env {
        NODE_ENV = "production"
        PORT = "3001"
        POSTGRES_HOST = "${NOMAD_UPSTREAM_ADDR_postgres}"
        REDIS_HOST = "${NOMAD_UPSTREAM_ADDR_redis}"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
```

---

## Service Discovery with Consul

### DNS-Based Discovery
```javascript
// Before (hardcoded):
const pgPool = new Pool({
  host: 'p2p-postgres',
  port: 5432
});

// After (Consul DNS):
const pgPool = new Pool({
  host: 'postgres.service.consul',
  port: 5432
});
```

### Benefits:
- Automatic failover (Consul routes to healthy instances)
- No hardcoded IPs or container names
- Health checks built-in
- Load balancing across multiple instances

---

## Deployment Process

### Initial Setup (One-Time)
```bash
# 1. Install Nomad on all VPS
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt update && sudo apt install nomad consul

# 2. Initialize Nomad cluster (on server nodes)
nomad agent -config=/etc/nomad.d/server.hcl

# 3. Join client nodes
nomad agent -config=/etc/nomad.d/client.hcl

# 4. Initialize Consul cluster
consul agent -config-dir=/etc/consul.d/
```

### Deploy Application
```bash
# Build Docker images
docker build -t p2p-file-share_metadata-api:latest ./metadata-api
docker build -t p2p-file-share_frontend:latest .
docker build -t p2p-file-share_envoy:latest -f Dockerfile.envoy .

# Push to registry (or load on each node)
docker save p2p-file-share_metadata-api:latest | ssh vps1 docker load
docker save p2p-file-share_metadata-api:latest | ssh vps2 docker load
docker save p2p-file-share_metadata-api:latest | ssh vps3 docker load

# Deploy jobs
nomad job run nomad/metadata-api.nomad
nomad job run nomad/frontend.nomad
nomad job run nomad/peerjs.nomad
nomad job run nomad/postgres.nomad
nomad job run nomad/redis.nomad
nomad job run nomad/envoy.nomad
nomad job run nomad/turn.nomad

# Check status
nomad status metadata-api
consul catalog services
```

### Rolling Updates
```bash
# Update image
docker build -t p2p-file-share_metadata-api:v2 ./metadata-api

# Update job spec (change image tag)
# metadata-api.nomad: image = "p2p-file-share_metadata-api:v2"

# Deploy (Nomad handles rolling update automatically)
nomad job run nomad/metadata-api.nomad

# Nomad will:
# 1. Start new instances with v2
# 2. Wait for health checks to pass
# 3. Stop old instances
# 4. Zero downtime deployment
```

---

## Monitoring & Observability

### Metrics (Prometheus + Grafana)
- Nomad metrics (job status, resource usage)
- Consul metrics (service health, DNS queries)
- Application metrics (API latency, P2P connections)
- Database metrics (query performance, connections)

### Logging (Loki or ELK)
- Centralized logs from all Nomad jobs
- Searchable, filterable
- Alerting on errors

### Alerting
- Service down (Consul health check fails)
- High CPU/memory usage
- Database connection pool exhausted
- TURN server unreachable

---

## Cost Breakdown

### Single VPS (Current)
- 1x VPS: $15/month
- **Total**: $15/month

### Multi-VPS with HashiCorp (3K-10K users)
- Load Balancer: $10/month
- Web VPS x3: $45/month
- Database VPS: $30/month
- TURN VPS: $20/month
- Monitoring VPS: $15/month
- **Total**: $120/month

### At Scale (50K+ users)
- Load Balancer x2: $20/month (HA)
- Web VPS x10: $150/month
- Database VPS x2: $60/month (primary + replica)
- Redis Cluster x3: $45/month
- TURN VPS x2: $40/month
- Monitoring: $20/month
- **Total**: $335/month

---

## Why HashiCorp Stack?

### vs Docker Swarm
- ✅ More flexible (runs Docker + native binaries)
- ✅ Better resource utilization
- ✅ Simpler than Kubernetes
- ✅ Active development (Docker Swarm is stagnant)

### vs Kubernetes
- ✅ Much simpler to learn and operate
- ✅ Lower resource overhead
- ✅ Better for small teams
- ✅ Easier debugging
- ❌ Smaller ecosystem (but sufficient for our needs)

### vs Systemd (Native)
- ✅ Multi-VPS support
- ✅ Automatic failover
- ✅ Rolling updates
- ✅ Service discovery
- ❌ More complex than systemd

---

## Next Steps

### Immediate (Current Focus)
1. ✅ Fix Docker Compose networking
2. ✅ Verify all proxy routes working
3. **Test file transfer end-to-end** ← YOU ARE HERE
4. Prove the product works

### Short-Term (Before Scaling)
1. Monitor user growth
2. Identify performance bottlenecks
3. Optimize database queries
4. Add monitoring/alerting

### Long-Term (When Scaling)
1. Write Nomad job specs for all services
2. Set up Consul cluster
3. Test Nomad deployment on staging VPS
4. Migrate to multi-VPS when hitting 1K+ concurrent users
5. Add Vault for secrets management
6. Implement multi-region deployment (if needed)

---

## References

- [Nomad Documentation](https://developer.hashicorp.com/nomad/docs)
- [Consul Service Discovery](https://developer.hashicorp.com/consul/docs/discovery)
- [Nomad Docker Driver](https://developer.hashicorp.com/nomad/docs/drivers/docker)
- [Consul DNS Interface](https://developer.hashicorp.com/consul/docs/discovery/dns)
- [Nomad Job Specification](https://developer.hashicorp.com/nomad/docs/job-specification)

---

**Bottom Line**: Keep Docker Compose for now. When you're ready to scale, HashiCorp stack (Nomad + Consul) gives you the orchestration you need without Kubernetes complexity. Migration path is clear and well-documented.
