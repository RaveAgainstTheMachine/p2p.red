# P2P File Share - Production Architecture

## Current Status: Dev + Prod (Active)

**Reality Check:** Prod runs on a single OVH VPS with separate TURN hosts. Dev runs on a LAN VM behind external NginxPM. This is stable for current testing but remains a single-point-of-failure on the prod VPS.

### Current Architecture Overview

```
                 ┌──────────────────────────────┐
                 │        dev.p2p.red           │
                 │   NginxPM (LAN, external)    │
                 └─────────────┬────────────────┘
                               │
                               ▼
                 ┌──────────────────────────────┐
                 │      Dev VM (10.10.10.77)    │
                 │  - Vite web :5173            │
                 │  - PeerJS   :5174            │
                 │  - Metadata :3001            │
                 └──────────────────────────────┘

                 ┌──────────────────────────────┐
                 │        p2p.red (prod)        │
                 │   Nginx (OVH VPS)            │
                 └─────────────┬────────────────┘
                               │
                               ▼
                 ┌──────────────────────────────┐
                 │   p2pred01 (OVH)             │
                 │  - Frontend                  │
                 │  - PeerJS                    │
                 │  - Metadata API              │
                 │  - Postgres + Redis          │
                 └─────────────┬────────────────┘
                               │
                               ▼
                 ┌──────────────────────────────┐
                 │      TURN VPS Pool           │
                 │   turn1/turn2 (InterServer)  │
                 └──────────────────────────────┘

                 ┌──────────────────────────────┐
                 │   bao.p2p.red (OVH)           │
                 │  - OpenBao                   │
                 │  - WireGuard Bastion         │
                 └──────────────────────────────┘
```

## Planned Scaling Architecture (Multi-VPS)

### Infrastructure Overview

```
                     ┌──────────────────────────────┐
                     │        DNS + TLS             │
                     │   (OVH VPS + Nginx)          │
                     └─────────────┬────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     Load Balancer VPS        │
                    │  - Nginx reverse proxy       │
                    │  - Health checks             │
                    └─────────────┬────────────────┘
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   WEB VPS 1      │   │   WEB VPS 2      │   │   WEB VPS 3      │
│ - Frontend       │   │ - Frontend       │   │ - Frontend       │
│ - PeerJS         │   │ - PeerJS         │   │ - PeerJS         │
└──────────────────┘   └──────────────────┘   └──────────────────┘
          └───────────────────────┼───────────────────────┘
                                  ▼
                    ┌──────────────────────────────┐
                    │     Database + Metadata      │
                    │  - PostgreSQL                │
                    │  - Redis                     │
                    │  - Metadata API              │
                    └─────────────┬────────────────┘
                                  ▼
                    ┌──────────────────────────────┐
                    │        TURN VPS Pool         │
                    │        turn1/turn2           │
                    └──────────────────────────────┘
```

### VPS Specifications & Costs

#### 1. Load Balancer VPS
- **Provider:** OVH
- **Specs:** 1 vCPU, 2GB RAM, 20GB SSD
- **Cost:** $5-10/month
- **Purpose:** Single entry point, SSL termination, traffic distribution
- **Software:** Nginx, Certbot, UFW

#### 2. Web VPS x3 (Horizontal Scaling)
- **Provider:** OVH
- **Specs:** 2 vCPU, 4GB RAM, 40GB SSD
- **Cost:** $10-15/month each ($30-45 total)
- **Capacity:** ~500-1,000 concurrent connections each
- **Purpose:** Serve frontend, handle PeerJS signaling
- **Software:** Docker, Nginx, PeerJS server, Node.js

#### 3. Database VPS
- **Provider:** OVH
- **Specs:** 4 vCPU, 8GB RAM, 80GB SSD
- **Cost:** $20-30/month
- **Purpose:** PostgreSQL, Redis, Metadata API
- **Software:** PostgreSQL 16, Redis 7, Node.js API
- **Backup:** Daily automated backups to object storage

#### 4. TURN Server VPS
- **Provider:** InterServer (current TURN hosts)
- **Specs:** 2 vCPU, 4GB RAM, 40GB SSD, **HIGH BANDWIDTH**
- **Cost:** $10-20/month
- **Purpose:** NAT traversal for P2P connections
- **Software:** coturn
- **Note:** Bandwidth is critical here

#### 5. Monitoring VPS
- **Provider:** OVH (or existing host)
- **Specs:** 2 vCPU, 4GB RAM, 40GB SSD
- **Cost:** $10-15/month
- **Purpose:** Metrics collection, alerting, dashboards
- **Software:** Prometheus, Grafana, Alertmanager

### Total Infrastructure Cost

- **Minimum (3K users):** $75-120/month
- **Scaled (10K users):** $150-250/month (add more Web VPS)
- **Enterprise (50K+ users):** $500+/month (DB clustering, CDN, etc.)

## Scaling Strategy

### Phase 1: Current (Dev + Single Prod VPS)
- **Capacity:** <100 concurrent users
- **Cost:** current OVH + TURN VPS costs
- **Status:** ✅ Deployed
- **Purpose:** Prove the end-to-end P2P flow works

### Phase 2: Multi-VPS (Production Launch)
- **Capacity:** 1,000-3,000 concurrent users
- **Cost:** $75-120/month
- **Components:**
  - 1x Load Balancer
  - 3x Web VPS
  - 1x Database VPS
  - 1x TURN VPS
  - 1x Monitoring VPS

### Phase 3: Scaled Production
- **Capacity:** 5,000-10,000 concurrent users
- **Cost:** $150-250/month
- **Changes:**
  - Add 3-5 more Web VPS
  - PostgreSQL read replicas
  - Redis cluster (3 nodes)
  - Multiple TURN servers

### Phase 4: High Scale (Self-Hosted)
- **Capacity:** 50,000+ concurrent users
- **Cost:** $500+/month (multiple OVH/InterServer nodes)
- **Changes:**
  - More Web VPS (auto-scaling via scripts)
  - PostgreSQL replicas (self-hosted)
  - Redis cluster (self-hosted)
  - More TURN VPS in multiple regions

## Performance Targets

### Current (Single VPS)
- **Concurrent Transfers:** 50-100
- **API Latency:** <50ms
- **P2P Connection Success:** 70-80% (STUN only)
- **Uptime:** 95%+ (single point of failure)

### Production (Multi-VPS)
- **Concurrent Transfers:** 3,000+
- **API Latency:** <20ms (Redis cache)
- **P2P Connection Success:** 95%+ (TURN enabled)
- **Uptime:** 99.5%+ (redundancy)

### Enterprise Scale
- **Concurrent Transfers:** 50,000+
- **API Latency:** <10ms (distributed cache)
- **P2P Connection Success:** 98%+ (global TURN network)
- **Uptime:** 99.9%+ (multi-region)

## Bottlenecks & Solutions

### 1. Database (First Bottleneck)
**Problem:** PostgreSQL write throughput
**Solution:**
- Connection pooling (already implemented)
- Read replicas for metadata retrieval
- Redis cache hit rate >95%
- Eventual consistency for analytics

### 2. TURN Server (Bandwidth Intensive)
**Problem:** NAT traversal relay consumes bandwidth
**Solution:**
- Multiple TURN servers (geographic distribution)
- Prefer STUN when possible (direct P2P)
- Monitor relay usage, scale accordingly

### 3. PeerJS Signaling (Connection Limits)
**Problem:** WebSocket connection limits per server
**Solution:**
- Horizontal scaling (add more Web VPS)
- Load balancer with sticky sessions
- Health checks to remove dead servers

### 4. Frontend Serving (Least Concern)
**Problem:** Static asset delivery
**Solution:**
- Nginx caching
- Gzip/Brotli compression

## Monitoring & Alerting

### Metrics to Track
- **System:** CPU, RAM, disk I/O, network bandwidth
- **Application:** API latency, error rates, cache hit ratio
- **Business:** Active transfers, short links created, success rate

### Critical Alerts
- VPS down (any server)
- Database connection pool exhausted
- Redis cache down
- API error rate >5%
- Disk usage >80%
- SSL certificate expiring <7 days

### Dashboards
- **Overview:** All services health, active users, transfer rate
- **Database:** Query performance, connection pool, cache stats
- **Network:** Bandwidth usage, P2P success rate, TURN relay usage

## Disaster Recovery

### Backups
- **PostgreSQL:** Daily full backup, hourly WAL archiving
- **Redis:** RDB snapshots every 6 hours
- **Configuration:** Git repository (already done)
- **Retention:** 30 days

### Failover Strategy
- **Web VPS:** Automatic (load balancer health checks)
- **Database:** Manual promotion of read replica
- **Load Balancer:** DNS failover to backup (manual)
- **TURN Server:** Multiple servers, client tries next on failure

### Recovery Time Objectives
- **Web VPS failure:** <1 minute (automatic)
- **Database failure:** <15 minutes (manual)
- **Complete disaster:** <1 hour (restore from backup)

## Security Considerations

### Network Security
- UFW firewall on all VPS
- Fail2ban for SSH brute force protection
- Private network for inter-VPS communication
- Rate limiting on all public endpoints

### Application Security
- HTTPS only (HSTS enabled)
- API key authentication for metadata writes
- CORS restrictions
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)

### Data Security
- End-to-end encryption for file transfers (client-side)
- No file content stored on servers
- Metadata expires after 24 hours
- No user tracking or PII collection

## Migration Path (Current → Production)

### Step 1: Prove It Works (NOW)
- Test file transfer end-to-end
- Verify short links work
- Confirm P2P connection establishment
- Measure performance baseline

### Step 2: Deploy Monitoring
- Set up Prometheus + Grafana
- Configure alerts
- Establish baseline metrics

### Step 3: Database Separation
- Move PostgreSQL + Redis to dedicated VPS
- Test failover procedures
- Set up automated backups

### Step 4: Add Redundancy
- Deploy 2 additional Web VPS
- Configure load balancer
- Test automatic failover

### Step 5: TURN Server
- Deploy dedicated TURN VPS
- Configure geographic routing
- Measure P2P success rate improvement

### Step 6: Optimize & Scale
- Tune database queries
- Implement read replicas
- Monitor and scale as needed

## Cost Optimization

### Free Tier Services
- **Let's Encrypt:** SSL certificates

### Paid Services to Consider
- **Object Storage:** Backups (self-hosted or provider with S3-compatible storage)

### When to Upgrade
- CPU usage >70% sustained
- RAM usage >80%
- Disk I/O wait >20%
- Network bandwidth >80% of limit
- API latency >100ms p95

## Current Architecture (Dev + Prod)

### What's Running Now
```
prod (p2pred01, OVH)
├── Nginx (reverse proxy, SSL)
├── Frontend (React app)
├── PeerJS Server (WebRTC signaling)
├── Metadata API (Node.js)
├── PostgreSQL (metadata storage)
└── Redis (cache)

turn1/turn2 (InterServer)
└── coturn (STUN/TURN)

bao.p2p.red (OVH)
├── OpenBao (secrets)
└── WireGuard hub + SSH bastion

dev (LAN VM + NginxPM)
├── Vite dev web (5173)
├── PeerJS dev (5174)
└── Metadata API dev (3001)
```

### Current Limitations
- **Single point of failure:** If VPS dies, everything dies
- **No redundancy:** Zero failover capability
- **Limited capacity:** ~100 concurrent users max
- **No monitoring:** Flying blind
- **No backups:** Data loss risk

### What We've Proven
- ✅ Short link system works (tested)
- ✅ Metadata API operational
- ✅ Database schema deployed
- ❌ File transfer NOT TESTED YET
- ❌ P2P connection NOT VERIFIED
- ❌ End-to-end flow UNPROVEN

## Next Steps

1. **TEST THE DAMN THING** - Verify file transfer actually works
2. **Update documentation** - Reflect current state
3. **Add monitoring** - Know when shit breaks
4. **Plan migration** - Multi-VPS architecture
5. **Scale when needed** - Not before

---

**Reality Check:** We built a scalable backend before proving the frontend works. That's backwards. Let's test first, then scale.
