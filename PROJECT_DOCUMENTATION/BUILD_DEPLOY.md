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

### 1) Deploy Metadata API (prod)
```
SECRETS_ENV_FILE=/run/secrets/metadata.env ./deploy-metadata-api.sh
```
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

## Verification Checklist
- Metadata API health returns `healthy`.
- Web loads and PeerJS connects.
- Dev routes are served via NginxPM (not prod nginx).
- Prod routes are served via VPS nginx.

## Rollback (Prod)
- If using blue/green: switch upstream back using `automation/switch-upstream.sh`.
- Otherwise: `docker compose restart` or revert to previous image tag.
