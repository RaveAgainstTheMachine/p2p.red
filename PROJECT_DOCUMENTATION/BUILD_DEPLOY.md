# Build & Deploy Guide (Dev + Prod)

This guide covers dev and prod build/deploy flows. Dev uses external Nginx Proxy Manager (NginxPM); prod uses VPS Nginx. Keep environments isolated.

## Prerequisites
- Docker + Compose plugin installed.
- OpenBao Agent running and rendering `/run/secrets/metadata.env` for metadata services.
- Dev reverse proxy is external NginxPM; do **not** edit prod nginx for dev.

## Dev Workflow (LAN + NginxPM)

### 1) Secrets + OpenBao Agent (dev)
Ensure permissions match the OpenBao image user:
```
sudo chown -R 100:1000 /var/lib/openbao-agent
sudo chmod 750 /var/lib/openbao-agent
sudo chmod 640 /var/lib/openbao-agent/agent.hcl /var/lib/openbao-agent/metadata.env.tpl \
  /var/lib/openbao-agent/role_id /var/lib/openbao-agent/secret_id

sudo chown 100:1000 /run/secrets
sudo chmod 770 /run/secrets
```

Start agent (systemd) and verify render:
```
sudo systemctl start openbao-agent.service
sudo systemctl status openbao-agent.service --no-pager -l
```
Look for: `rendered "/agent/metadata.env.tpl" => "/run/secrets/metadata.env"`.

### 2) Deploy Metadata API (dev)
```
SECRETS_ENV_FILE=/run/secrets/metadata.env ./deploy-metadata-api.sh
```
Health check:
```
curl http://localhost:3001/health
```

### 3) Start Dev Web (Vite)
```
cd /opt/p2p-file-share/packages/web
pnpm install
pnpm dev -- --host 0.0.0.0 --port 5173
```

### 4) Start Dev PeerJS (Docker)
```
cd /opt/p2p-file-share
docker build -f Dockerfile.peerjs -t dev-peerjs .
docker run -d --name dev-peerjs -p 5174:9000 dev-peerjs
```

### 5) Verify NginxPM Routing
- dev web domain -> `http://10.10.10.77:5173`
- dev signal domain -> `http://10.10.10.77:5174`
- dev TURN (optional) -> `http://10.10.10.77:5175`

## Prod Workflow (OVH VPS)

### Signal Domain TLS (prod)
`signal.p2p.red` has its own TLS cert and nginx server block (PeerJS only).
Because the nginx container owns :80/:443, issue certs with a short nginx stop:
```
docker stop p2p-nginx
sudo certbot certonly --standalone -d signal.p2p.red
docker start p2p-nginx
```
Then reload nginx with the updated config (nginx.conf / nginx.blue-green.conf):
```
docker cp /opt/p2p-file-share/nginx.conf p2p-nginx:/etc/nginx/nginx.conf
docker exec -i p2p-nginx nginx -t && docker exec -i p2p-nginx nginx -s reload
```

### Plausible Analytics (prod)
Plausible is self-hosted on the prod VPS and exposed via `plausible.p2p.red`.

Required env vars (docker-compose.yml):
- `PLAUSIBLE_DB_PASSWORD`
- `PLAUSIBLE_SECRET_KEY_BASE`

Issue TLS certs:
```
docker stop p2p-nginx
sudo certbot certonly --standalone -d plausible.p2p.red
docker start p2p-nginx
```

Reload nginx after certs/config updates:
```
docker cp /opt/p2p-file-share/nginx.conf p2p-nginx:/etc/nginx/nginx.conf
docker exec -i p2p-nginx nginx -t && docker exec -i p2p-nginx nginx -s reload
```

Initial Plausible DB bootstrap (first-time only):
```
cd /opt/p2p-file-share
docker exec -i p2p-plausible-events-db clickhouse-client --query="CREATE DATABASE IF NOT EXISTS plausible_events"

docker run --rm --env-file /run/secrets/plausible.env \
  -e BASE_URL=https://plausible.p2p.red \
  -e CLICKHOUSE_DATABASE_URL=http://plausible-events-db:8123/plausible_events \
  --network p2p-file-share_p2p-network \
  plausible/analytics:latest bin/plausible eval "Plausible.Release.createdb"

docker run --rm --env-file /run/secrets/plausible.env \
  -e BASE_URL=https://plausible.p2p.red \
  -e CLICKHOUSE_DATABASE_URL=http://plausible-events-db:8123/plausible_events \
  --network p2p-file-share_p2p-network \
  plausible/analytics:latest bin/plausible eval "Plausible.Release.migrate"
```

## Zero-Downtime Readiness Checklist (Prod)
- OpenBao Agent renders `/run/secrets/metadata.env` and file readable by service user.
- Metadata API health check returns `healthy` locally (`http://localhost:3001/health`).
- TURN credentials endpoint returns `200` locally (`http://localhost:3001/api/turn-credentials`).
- Nginx routes (`p2p.red`, `signal.p2p.red`) point to the correct upstreams.
- Blue/green services are built and start cleanly (`docker compose -f docker-compose.blue-green.yml up -d`).
- Smoke test: open web app, create a share link, connect a second client, verify WebRTC connection.
- Rollback plan verified (`automation/switch-upstream.sh`).

### Recent Prod Findings (2026-01-20)
- `/run/secrets/metadata.env` exists, but `p2p-metadata-api` container was **Exited**.
- `curl http://localhost:3001/health` and `/api/turn-credentials` failed because the API was down.
- Root cause is the metadata container not running; restart via:
  `SECRETS_ENV_FILE=/run/secrets/metadata.env ./deploy-metadata-api.sh`
- Upgraded Docker Compose to v2 on prod + dev (use `docker compose`, not `docker-compose`).
- OpenBao Agent is enabled on prod and renders `/run/secrets/metadata.env` from Bao.
- If Postgres auth fails after secrets updates, sync the DB user password to the Bao secret:
  `PASS=$(sed -n 's/^POSTGRES_PASSWORD=//p' /run/secrets/metadata.env)`
  `docker exec -i p2p-postgres psql -U p2p_api_user -d p2p_metadata -c "ALTER USER p2p_api_user WITH PASSWORD '$PASS';"`
- TURN credentials require `METADATA_API_ENV_FILE=/run/secrets/metadata.env` so the app reads `TURN_SECRET` from the rendered file.

### Recent Prod Findings (2026-01-21)
- Prod runtime host does **not** include full source/Dockerfiles; it only has compose + image tars.
- Build `p2p-metadata-api` **locally**, ship tar to prod, then load + restart:
```
# Local build + save
docker build -f metadata-api/Dockerfile -t p2p-metadata-api:latest /opt/p2p-file-share/metadata-api
docker save -o /opt/p2p-file-share/images/metadata-api.tar p2p-metadata-api:latest

# Copy to prod via WG
scp -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  /opt/p2p-file-share/images/metadata-api.tar ubuntu@10.88.0.10:/tmp/metadata-api.tar

# Move, load, restart (prod)
ssh -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  ubuntu@10.88.0.10 \
  "sudo mv /tmp/metadata-api.tar /opt/p2p-file-share/images/metadata-api.tar && \
   sudo docker load -i /opt/p2p-file-share/images/metadata-api.tar && \
   cd /opt/p2p-file-share && \
   sudo METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d --no-deps metadata-api"
```
- `deploy-metadata-api.sh` now supports `METADATA_TAR=/path/to/metadata-api.tar` and `SKIP_BUILD=1` to load prebuilt images.

### Full Prod Image Rebuild + Tar Prep (Local)
```
# Ensure build variant shows in UI (blue/green indicator)
export VITE_BUILD_VARIANT=green

# If dist is owned by root from a prior Docker build:
# sudo chown -R $USER:$USER /opt/p2p-file-share/dist

# Build web app (blue/green images)
docker build -f Dockerfile -t p2p-app-blue:latest /opt/p2p-file-share
docker tag p2p-app-blue:latest p2p-app-green:latest

# Build metadata API
docker build -f metadata-api/Dockerfile -t p2p-metadata-api:latest /opt/p2p-file-share/metadata-api

# Build PeerJS + Nginx
docker build -f Dockerfile.peerjs -t p2p-peerjs:latest /opt/p2p-file-share
docker build -f Dockerfile.nginx -t p2p-nginx:latest /opt/p2p-file-share

# Save image tars
docker save -o /opt/p2p-file-share/images/app-blue.tar p2p-app-blue:latest
docker save -o /opt/p2p-file-share/images/app-green.tar p2p-app-green:latest
docker save -o /opt/p2p-file-share/images/metadata-api.tar p2p-metadata-api:latest
docker save -o /opt/p2p-file-share/images/peerjs.tar p2p-peerjs:latest
docker save -o /opt/p2p-file-share/images/nginx.tar p2p-nginx:latest
```

### 1) Deploy Metadata API (prod)
```
SECRETS_ENV_FILE=/run/secrets/metadata.env ./deploy-metadata-api.sh
```
Ports are bound to localhost only (`127.0.0.1:3001/5432/6379`). Use SSH tunnel for remote access.
Health check:
```
curl http://localhost:3001/health
```

### 2) Deploy App Stack
```
./deploy.sh
```

### 3) Blue/Green (if enabled)
```
./automation/deploy-zero-downtime.sh
```

### Manual nginx restart (prod)
When updating nginx only, still export the metadata env file or compose will error parsing the metadata-api service:
```
METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d --no-deps nginx
```

## Verification Checklist (dev)
- Metadata API health returns `healthy`.
- Web loads and PeerJS connects.
- Dev routes are served via NginxPM (not prod nginx).

## Verification Checklist (prod)
- Metadata API health returns `healthy`.
- Web loads and PeerJS connects.
- Prod routes are served via VPS nginx.

## Rollback (Prod)
- If using blue/green: switch upstream back using `automation/switch-upstream.sh`.
- Otherwise: `docker compose restart` or revert to previous image tag.
