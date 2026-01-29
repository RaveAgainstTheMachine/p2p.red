# Build & Deploy Guide (Dev + Prod)

This guide covers dev and prod build/deploy flows. Dev uses external Nginx Proxy Manager (NginxPM); prod uses Envoy on the VPS. Keep environments isolated.

## Prerequisites
- Docker + Compose plugin installed.
- OpenBao Agent running and rendering `/run/secrets/metadata.env` for metadata services.
- Dev reverse proxy is external NginxPM; do **not** edit prod Envoy for dev.
- Dev deploy scripts use `envoy.dev.yaml` (HTTP-only) when `DEPLOY_ENV=dev`.

## Release Versioning Policy
- We follow **SemVer**: `MAJOR.MINOR.PATCH`.
- **PATCH**: bug fixes, copy tweaks, or internal changes (no breaking behavior).
- **MINOR**: new features that keep existing behavior compatible.
- **MAJOR**: breaking changes to APIs, protocol behavior, or UI/flows that require user action.

**Authoritative version source:**
- Root `package.json` (`/opt/p2p-file-share/package.json`) is the app version used for builds.

**Build labels:**
- `automation/build-prod-images.sh` and `automation/build-local-prod-images.sh` generate `VITE_BUILD_VERSION` from:
  - `APP_VERSION` (root `package.json`)
  - short git SHA
  - UTC timestamp

**Bumping the version:**
- Update the root `package.json` version before a release.
- Use the SemVer rules above to decide the bump (e.g., `1.0.0` -> `1.0.1` for a patch).

## Dev Workflow (LAN + NginxPM)

Note: `deploy.sh`/`deploy-and-test.sh` in dev mount `envoy.dev.yaml` via `ENVOY_CONFIG` (HTTP-only) for local testing; NginxPM still owns dev domains.

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

If running the web app on a custom local port, align CORS:
```
# Example for Vite at http://127.0.0.1:5180
CORS_ORIGIN=http://127.0.0.1:5180 docker compose -f docker-compose.metadata.yml up -d --force-recreate metadata-api
```

Initialize the metadata DB schema (first-time only):
```
docker exec -i p2p-postgres psql -U p2p_api_user -d p2p_metadata < /opt/p2p-file-share/metadata-api/db/init.sql
```

### 3) Start Dev Web (Vite)
```
cd /opt/p2p-file-share/packages/web
pnpm install
pnpm dev -- --host 0.0.0.0 --port 5173
```

For root dev (Vite at a custom port), set API base and restart Vite:
```
# /opt/p2p-file-share/.env.local
VITE_API_URL=http://127.0.0.1:3001
```

Note: `/js/script.js` 404s locally unless Plausible is proxied; safe to ignore in dev.

### Dev Docker Image Storage (200GB disk)
Images are stored on the 200GB disk mounted at `/mnt/docker`.

Mount + persist:
```
sudo mount /dev/sdb1 /mnt/docker
sudo tee -a /etc/fstab >/dev/null <<'EOF'
UUID=0e52eef1-9039-4d96-bcc2-2cb6dd14fcce /mnt/docker ext4 defaults,noatime 0 2
EOF
```

Docker data root:
```
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "data-root": "/mnt/docker"
}
EOF
sudo systemctl restart docker
```

Verify:
```
docker info -f '{{.DockerRootDir}}'
df -hT /mnt/docker
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

**Latest release notes (2026-01-29)**
- Removed the site-wide "Under Construction" banner.

## Local Prod Parity (HTTPS + Local IP)

Goal: run the **prod stack locally** (Envoy + blue/green + serve + CSP) without domains.
Use local IPs with HTTPS so browser behavior matches production.

**Requirements**
- Local TLS certs at `./local-certs/local.crt` + `./local-certs/local.key`.
- Secrets at `./local-secrets/metadata.env` + `./local-secrets/plausible.env`.
- Use OpenBao as the source of truth for secrets.

**Generate local TLS certs (mkcert)**
```
LOCAL_P2P_HOST=127.0.0.1 ./automation/local-prod-certs.sh
```

**Render local secrets (choose one)**

OpenBao (source of truth):
```
BAO_ADDR=https://bao.p2p.red:8200 BAO_TOKEN=*** ./automation/render-local-secrets.sh
```

Local-only (no OpenBao):
```
./automation/local-prod-secrets.sh
```

**Build local images (blue/green + services)**
```
LOCAL_P2P_HOST=127.0.0.1 LOCAL_HTTPS_PORT=8443 ./automation/build-local-prod-images.sh
```

**Start the local prod-parity stack**
```
LOCAL_P2P_HOST=127.0.0.1 LOCAL_HTTPS_PORT=8443 docker compose -f docker-compose.local-prod.yml up -d
```

**Preflight (download bridge + API + Envoy)**
```
INSECURE=1 LOCAL_P2P_HOST=127.0.0.1 LOCAL_HTTPS_PORT=8443 ./automation/local-prod-preflight.sh
```

**Access**
- App: `https://127.0.0.1:8443`
- Envoy admin: `http://127.0.0.1:9901`

**Local prod-parity test checklist**
1. App loads over HTTPS without mixed-content warnings.
2. Download bridge endpoint returns HTML:
   - `GET /download-bridge/bridge.html` => `200` + `text/html`.
3. PeerJS reachable via Envoy:
   - `GET /peerjs/id` returns a PeerJS ID.
4. Metadata API reachable via Envoy:
   - `GET /api/status` returns JSON.
5. Run a real P2P transfer (no mocks) to validate WebRTC + download bridge.

**Troubleshooting (local parity)**
- Envoy restarts with `Failed to load incomplete private key`:
  - Regenerate local certs: `./automation/local-prod-certs.sh`
  - Ensure `local-certs/local.key` is a PKCS#1 RSA key and readable by the container.
- Download bridge preflight timeout:
  - Run `INSECURE=1 ./automation/local-prod-preflight.sh` and confirm bridge HTML.

## One-Command Safety Workflow (Authoritative)

Use these scripts to eliminate environment confusion and missing-preflight failures.

### 0) Identify Environment (Required)
```
./automation/where-am-i.sh
```

Prod hosts must have the explicit marker file:
```
echo prod | sudo tee /etc/p2pred-env
```

### 1) Preflight Checks (Required)

Dev:
```
DEPLOY_ENV=dev ./automation/preflight.sh dev
```

Prod:
```
DEPLOY_ENV=prod ./automation/preflight.sh prod
```

### 2) Prod Release (Single Entry Point)

On the prod host, once images are loaded:
```
DEPLOY_ENV=prod USE_PREBUILT_IMAGES=1 ./automation/release-prod.sh
```

## Blue/Green Zero-Downtime Deployment (Prod)

This is the **authoritative** blue/green procedure. Always check which color is live **before** deploying and only deploy the inactive color.

**UI/UX confirmation requirement (prod):**
- Any UI/UX changes must be reviewed and explicitly confirmed by the project owner **before** running a production release.
- If confirmation is pending, stop after local verification and wait.

### A) Determine Which Color Is Live (Required)
Use the Envoy runtime weights because they are the source of truth for live traffic.
```
# On prod host
cd /opt/p2p-file-share

# Check live weights via Envoy admin API
ENVOY_ADMIN_URL=${ENVOY_ADMIN_URL:-http://127.0.0.1:9901}
curl -fsS "$ENVOY_ADMIN_URL/runtime?format=json" | \
  sed -n 's/.*"traffic_split.app_\(blue\|green\)"[[:space:]]*:[[:space:]]*"\([0-9]*\)".*/\1=\2/p'

# Expect higher weight to be active (blue=100/green=0 or vice-versa)
```
Optional cross-checks:
```
docker ps --filter "label=version" --format "{{.Names}} {{.Labels}}"
docker inspect -f '{{ index .Config.Labels "p2p.build_version" }}' p2p-app-blue
docker inspect -f '{{ index .Config.Labels "p2p.build_version" }}' p2p-app-green
curl -s https://p2p.red | head -n 3
```

**Rule:**
- If **blue** is live, deploy **green**.
- If **green** is live, deploy **blue**.

### B) Build + Transfer Images (Local → Prod)
Prod runtime host does **not** have full source. Build locally and ship tars.
```
# Local build (authoritative)
# This script builds BOTH colors with explicit VITE_BUILD_VARIANT
# and validates the p2p.build_variant label on each image.
# It injects prod VITE_* values (API + PeerJS) so prod bundles never
# inherit dev .env.local settings, and also injects VITE_BUILD_VERSION
# (SemVer + git SHA + UTC timestamp) with p2p.build_version validation.
# PeerJS prod routing is via signal.p2p.red with /peerjs path.
# If PeerJS websocket fails in prod, confirm the build args include:
#   VITE_PEERJS_HOST=signal.p2p.red
#   VITE_PEERJS_PATH=/peerjs
./automation/build-prod-images.sh

# Copy to prod via WG
scp -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  /opt/p2p-file-share/images/*.tar ubuntu@10.88.0.10:/tmp/
```

### C) Load Images + Deploy Inactive Color (Prod)
```
# On prod host
ssh -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  ubuntu@10.88.0.10

sudo mv /tmp/*.tar /opt/p2p-file-share/images/
sudo docker load -i /opt/p2p-file-share/images/app-blue.tar
sudo docker load -i /opt/p2p-file-share/images/app-green.tar
sudo docker load -i /opt/p2p-file-share/images/metadata-api.tar
sudo docker load -i /opt/p2p-file-share/images/peerjs.tar
sudo docker load -i /opt/p2p-file-share/images/envoy.tar

cd /opt/p2p-file-share

# Runtime services (metadata + peerjs + envoy)
sudo METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d

# Zero-downtime app switch (prod requires prebuilt images)
USE_PREBUILT_IMAGES=1 \
  APP_IMAGE_BLUE=p2p-app-blue:latest \
  APP_IMAGE_GREEN=p2p-app-green:latest \
  ./automation/deploy-zero-downtime.sh
```

### D) Verify + Switch Outcome
```
curl -s https://p2p.red/api/status | jq
curl -s https://p2p.red | head -n 3
```

### Ops: Metadata API request logging (prod)
Request logging is **off by default** in production. To enable temporarily, set:
```
METADATA_API_LOG_REQUESTS=on
```
in `docker-compose.yml` for the `metadata-api` service and redeploy runtime services:
```
sudo METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d
```
To disable again, set `METADATA_API_LOG_REQUESTS=off` and repeat the same command.

PeerJS smoke checks (prod):
```
curl -fsS https://signal.p2p.red/peerjs/id
curl -sS -D - -o /dev/null --http1.1 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Origin: https://p2p.red' \
  'https://signal.p2p.red/peerjs?key=peerjs&id=test&token=tok&version=1.5.5'
```

#### Prod Incident: Stale UI + nginx crash (2026-01-21)
**Symptoms**
- UI stayed stale (no FAQ/how-it-works) and badge color mismatch.
- `p2p-nginx` restart loop with: `host not found in upstream "p2p-app-green:3000"`.

**Root cause**
- Nginx was serving static HTML from its own image (`root /usr/share/nginx/html`) instead of proxying to the blue/green app container. That kept serving old bundles even after deploys.
- Nginx config referenced a blue/green upstream that wasn’t running, causing nginx to crash-loop.

**Fix**
- Proxy `/` and `/assets/` to the blue/green `app` upstream in `nginx.conf` and `nginx.blue-green.conf` (no static root for the main site).
- Ensure the target app container is running **before** restarting nginx.

**Verification**
```
curl -sL https://p2p.red | grep -oE '/assets/[^" ]+' | head -n 2
curl -sL https://p2p.red/assets/<latest>.js | grep -i 'How it works\|FAQ'
curl -s https://p2p.red/api/status | jq
```
Confirm the UI shows the expected **blue/green badge** and the build **version** below it.

### E) Rollback (If Needed)
```
./automation/switch-upstream.sh blue
./automation/switch-upstream.sh green
```

### Notes (Operational Guardrails)
- **Never** deploy both colors at once.
- Always deploy the **inactive** color and switch via Envoy.
- `automation/deploy-zero-downtime.sh` checks **Envoy runtime weights** to decide the active color.
- Runtime weights are persisted under `envoy-runtime/traffic_split` and mounted into Envoy.
- Prod deploys require **prebuilt images** (`USE_PREBUILT_IMAGES=1`) to prevent local builds on prod.
- UI/UX changes require explicit project-owner confirmation **before** prod release.
- Build images only via `automation/build-prod-images.sh` (labels `p2p.build_variant` are enforced).
- If the build indicator is missing or wrong, rebuild locally (do not proceed).
- Envoy admin API must be reachable at `127.0.0.1:9901` for weight shifts.
- Image retention policy:
  - **prod** keeps current + 1 previous image per variant.
  - **dev** keeps up to 10 previous images per variant.
  - `automation/cleanup-images.sh` enforces this (runs after deploy). Override with `KEEP_IMAGE_COUNT`.
- The switch may still cause brief blips during traffic shifts if the target app is unhealthy. Use env vars to reduce impact:
  - `SWITCH_GRACE_SECONDS` (default: 5)
  - `POST_SWITCH_VERIFY_DELAY` (default: 5)
  - `OLD_ENV_STOP_DELAY` (default: 15)
### Signal Domain TLS (prod)
`signal.p2p.red` has its own TLS cert and Envoy filter chain (PeerJS only).
Because the Envoy container owns :80/:443, issue certs with a short Envoy stop:
```
docker stop p2p-envoy
sudo certbot certonly --standalone -d signal.p2p.red
docker start p2p-envoy
```

### Envoy TLS Cert Handling (prod)
Envoy reads PKCS#12 bundles from `/var/snap/docker/common/p2p-envoy-certs`.

**Rules:**
- Use **RSA** certs (Let’s Encrypt reissue with `--key-type rsa`).
- Generate PKCS#12 bundles with password `p2pred`.
- Ensure perms: cert dir `755`, `.p12` files `644` (readable by Envoy).

**Reissue + Convert (example for p2p.red):**
```
docker stop p2p-envoy
sudo certbot certonly --standalone --key-type rsa --rsa-key-size 2048 -d p2p.red -d www.p2p.red

sudo mkdir -p /var/snap/docker/common/p2p-envoy-certs
sudo openssl pkcs12 -export \
  -out /var/snap/docker/common/p2p-envoy-certs/p2p.red.p12 \
  -inkey /etc/letsencrypt/live/p2p.red/privkey.pem \
  -in /etc/letsencrypt/live/p2p.red/fullchain.pem \
  -passout pass:p2pred

sudo chmod 755 /var/snap/docker/common/p2p-envoy-certs
sudo chmod 644 /var/snap/docker/common/p2p-envoy-certs/p2p.red.p12
docker start p2p-envoy
```

Repeat for `signal.p2p.red` and `plausible.p2p.red` (matching filenames in `envoy.yaml`).

### Plausible Analytics (prod)
Plausible is self-hosted on the prod VPS and exposed via `plausible.p2p.red`.

**First-party proxy (recommended):**
- Envoy on `p2p.red` proxies:
  - `/js/script.js` -> `http://plausible/js/script.js`
  - `/api/event` -> `http://plausible/api/event`
- Script tag should use first-party path:
  - `<script defer data-domain="p2p.red" src="/js/script.js"></script>`

Required env vars (docker-compose.yml):
- `PLAUSIBLE_DB_PASSWORD`
- `PLAUSIBLE_SECRET_KEY_BASE`

Issue TLS certs:
```
docker stop p2p-envoy
sudo certbot certonly --standalone -d plausible.p2p.red
docker start p2p-envoy
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
- Envoy routes (`p2p.red`, `signal.p2p.red`) point to the correct upstreams.
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

# Build PeerJS + Envoy
docker build -f Dockerfile.peerjs -t p2p-peerjs:latest /opt/p2p-file-share
docker build -f Dockerfile.envoy -t p2p-envoy:latest /opt/p2p-file-share

# Save image tars
docker save -o /opt/p2p-file-share/images/app-blue.tar p2p-app-blue:latest
docker save -o /opt/p2p-file-share/images/app-green.tar p2p-app-green:latest
docker save -o /opt/p2p-file-share/images/metadata-api.tar p2p-metadata-api:latest
docker save -o /opt/p2p-file-share/images/peerjs.tar p2p-peerjs:latest
docker save -o /opt/p2p-file-share/images/envoy.tar p2p-envoy:latest
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

### Manual Envoy restart (prod)
When updating Envoy only, still export the metadata env file or compose will error parsing the metadata-api service:
```
METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d --no-deps envoy
```

### Envoy Runtime Weights (prod)
Envoy bootstraps traffic weights from disk so a restart never defaults to an empty split:

- Runtime defaults live in `envoy-runtime/traffic_split/app_blue` + `app_green`.
- `automation/envoy-shift-traffic.sh` updates both the runtime files and the admin runtime layer.

**Recovery if weights are missing:**
```
curl -sS -X POST "http://127.0.0.1:9901/runtime_modify?traffic_split.app_blue=100&traffic_split.app_green=0"
```

## Verification Checklist (dev)
- Metadata API health returns `healthy`.
- Web loads and PeerJS connects.
- Dev routes are served via NginxPM (not prod Envoy).

## Verification Checklist (prod)
- Metadata API health returns `healthy`.
- Web loads and PeerJS connects.
- Prod routes are served via VPS Envoy.

## Rollback (Prod)
- If using blue/green: switch upstream back using `automation/switch-upstream.sh`.
- Otherwise: `docker compose restart` or revert to previous image tag.
