# Windsurf Handoff — Dev Migration + Infra Status (Redacted)

## Current Infra Targets
- **Prod signal/web**: `<host>` (OVH, <public-ip>) — keep live deployment, remove TURN role later.
- **TURN-1**: `<host>` (<public-ip>)
- **TURN-2**: `<host>` (<public-ip>)
- **Dev VM**: `<host>` (LAN <lan-ip>, tunnel `<ssh-tunnel-host>:<port>`), NginxPM is on **<lan-ip>**.

## Dev Domains + Ports (NginxPM already points here)
- `<dev-web-domain>` → 5173
- `<dev-signal-domain>` → 5174
- `<dev-turn-domain>` → 5175

## Dev VM Status
- Docker installed (Docker CE + Compose plugin).
- Repo cloned to `/opt/p2p-file-share` and ownership set to `<user>:<group>`.
- Git pull done as `<user>` (credential helper set to store).
- SSH reachability: `ssh -p <port> <user>@<ssh-host>` works.

## Code Updates Just Pushed
- **Dev PeerJS env overrides** added so dev domains can configure PeerJS + API without code changes.
  - `src/config/environments.ts`
  - `packages/web/src/config/environments.ts`
 - **Automation + CI + docs cleanup committed**:
   - `e634de5` chore(automation): add deploy-and-test, env-aware deploys, dry-run sync, CI stub
   - `95955d7` docs: consolidate infra and WebRTC guidance
   - `8f7a6d1` chore: remove deprecated private status docs

## Next Steps (Dev)
1) Create `.env` for dev web (suggested):
   ```
   VITE_API_URL=https://<dev-web-domain>
   VITE_PEERJS_HOST=<dev-signal-domain>
   VITE_PEERJS_PORT=443
   VITE_PEERJS_SECURE=true
   ```
2) Start dev web on 5173:
   ```bash
   cd /opt/p2p-file-share/packages/web
   pnpm install
   pnpm dev -- --host 0.0.0.0 --port 5173
   ```
3) Start dev PeerJS signaling on 5174 (Docker):
   ```bash
   cd /opt/p2p-file-share
   docker build -f Dockerfile.peerjs -t dev-peerjs .
   docker run -d --name dev-peerjs -p 5174:9000 dev-peerjs
   ```
4) Start dev TURN on 5175 (Docker):
   ```bash
   docker run -d --name dev-turn \
     -p 5175:5175 -p 5175:5175/udp \
     coturn/coturn:latest \
     -n --log-file=stdout --listening-port=5175 \
     --realm=dev.p2p.red --user=p2puser:p2ppass123 \
     --no-tls --no-dtls --fingerprint \
     --min-port=49160 --max-port=49200
   ```

## Next Steps (Infra)
- **Prod server**: audit and remove/disable TURN config from prod compose.
- **TURN-1/2**: deploy coturn with TLS and firewall rules.
- **Ops stack**: Portainer CE, Uptime Kuma, Grafana/Prometheus/Loki, Netdata behind `ops.p2p.red` with VPN/Basicauth.

## Automation (Build/Deploy + Public Sync)
Decision: **implement now**. Automation scripts added to `automation/`:

1) **Full deploy** (metadata stack + app stack)
   ```bash
   chmod +x automation/deploy-all.sh
   ./automation/deploy-all.sh
   ```
   Requirements: `metadata-api/.env` and `turnserver.conf` present and configured.
   Options: `DEPLOY_ENV=dev|prod`, `SITE_URL=...`, `METADATA_HEALTH_URL=...`

   Deploy + health checks:
   ```bash
   chmod +x automation/deploy-and-test.sh
   ./automation/deploy-and-test.sh
   ```

2) **Public repo sync + redaction**
   ```bash
   chmod +x automation/public-sync.sh
   PUBLIC_REPO=/path/to/public-repo ./automation/public-sync.sh
   ```
   This syncs dev → public, excludes private docs/secrets, and redacts domains/IPs in docs/scripts/configs.
   Dry run (no changes):
   ```bash
   PUBLIC_SYNC_DRY_RUN=1 PUBLIC_REPO=/path/to/public-repo ./automation/public-sync.sh
   ```

3) **Automation README + Makefile**
   - `automation/README.md` documents the scripts and Makefile usage.
   - `make deploy-all`
   - `make deploy-and-test`
   - `make help`
   - `make public-sync PUBLIC_REPO=/path/to/public-repo`

4) **Root README**
   - Added automation section with links to `automation/README.md` and Make targets.

5) **CI stub**
   - Added `.github/workflows/ci.yml` (lint/type-check/build).

## Handoff Policy
- Keep this document updated as automation or infra workflows change.

## Notes
- NginxPM is external to the dev VM (<lan-ip>). Dev VM doesn’t manage TLS.
- SSH via tunnel: `<ssh-tunnel-host>:<port>` (TCP stream).
